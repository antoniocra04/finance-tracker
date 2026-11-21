package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"math"
	"sort"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

const schema = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, institution TEXT NOT NULL, currency TEXT NOT NULL, type TEXT NOT NULL, archived_at TEXT);
CREATE TABLE IF NOT EXISTS balances (id INTEGER PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), date TEXT NOT NULL, amount INTEGER NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS balance_dates ON balances(account_id,date,id);
CREATE TABLE IF NOT EXISTS rates (date TEXT PRIMARY KEY, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
INSERT OR IGNORE INTO settings VALUES ('base','RUB');
`

type database interface {
	Exec(string, ...any) (sql.Result, error)
	Query(string, ...any) (*sql.Rows, error)
	QueryRow(string, ...any) *sql.Row
}

type Account struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Institution string  `json:"institution"`
	Currency    string  `json:"currency"`
	Type        string  `json:"type"`
	ArchivedAt  *string `json:"archived_at"`
}
type balance struct {
	ID        int64  `json:"id"`
	AccountID string `json:"account_id"`
	Date      string `json:"date"`
	Amount    int64  `json:"amount"`
	Note      string `json:"note"`
	CreatedAt string `json:"created_at"`
}
type Snapshot struct {
	Date       string             `json:"date"`
	UpdatedAt  string             `json:"updatedAt,omitempty"`
	NextUpdate string             `json:"nextUpdate,omitempty"`
	Rates      map[string]float64 `json:"rates"`
}
type exportData struct {
	Version    int        `json:"version"`
	ExportedAt string     `json:"exportedAt"`
	Base       string     `json:"base"`
	Accounts   []Account  `json:"accounts"`
	Balances   []balance  `json:"balances"`
	Rates      []Snapshot `json:"rates"`
}

func openStore(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec("PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;" + schema); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func transact(db *sql.DB, operation func(*sql.Tx) error) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := operation(tx); err != nil {
		return err
	}
	return tx.Commit()
}

func setting(db database, key string) (string, error) {
	var value string
	err := db.QueryRow("SELECT value FROM settings WHERE key=?", key).Scan(&value)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return value, err
}

func setSetting(db database, key, value string) error {
	_, err := db.Exec("INSERT OR REPLACE INTO settings VALUES (?,?)", key, value)
	return err
}

func (app *application) setSetting(key, value string) error { return setSetting(app.db, key, value) }

func updateExisting(db database, absentMessage, statement string, args ...any) error {
	result, err := db.Exec(statement, args...)
	if err != nil {
		return err
	}
	count, err := result.RowsAffected()
	if err == nil && count == 0 {
		return invalid(absentMessage)
	}
	return err
}

func listRows[T any](db database, query string, scan func(*sql.Rows) (T, error)) ([]T, error) {
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []T{}
	for rows.Next() {
		value, err := scan(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, value)
	}
	return result, rows.Err()
}

func readAccounts(db database) ([]Account, error) {
	return listRows(db, "SELECT id,name,institution,currency,type,archived_at FROM accounts ORDER BY rowid", func(rows *sql.Rows) (a Account, err error) {
		err = rows.Scan(&a.ID, &a.Name, &a.Institution, &a.Currency, &a.Type, &a.ArchivedAt)
		return
	})
}

func readBalances(db database) ([]balance, error) {
	return listRows(db, "SELECT id,account_id,date,amount,note,created_at FROM balances ORDER BY date,id", func(rows *sql.Rows) (b balance, err error) {
		err = rows.Scan(&b.ID, &b.AccountID, &b.Date, &b.Amount, &b.Note, &b.CreatedAt)
		return
	})
}

func decodeSnapshot(data string) (Snapshot, error) {
	var snapshot Snapshot
	err := json.Unmarshal([]byte(data), &snapshot)
	return snapshot, err
}

func latestRates(db database) (*Snapshot, error) {
	var payload string
	err := db.QueryRow("SELECT payload FROM rates ORDER BY date DESC LIMIT 1").Scan(&payload)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	snapshot, err := decodeSnapshot(payload)
	return &snapshot, err
}

func availableCurrencies(db database) (map[string]bool, error) {
	codes := map[string]bool{}
	for _, code := range strings.Fields(standardCurrencies) {
		codes[code] = true
	}
	// Preserve currencies found in existing SQLite databases or provider snapshots.
	result, err := listRows(db, "SELECT DISTINCT currency FROM accounts UNION SELECT DISTINCT fx.key FROM rates,json_each(rates.payload,'$.rates') AS fx", func(rows *sql.Rows) (code string, err error) {
		err = rows.Scan(&code)
		return
	})
	if err != nil {
		return nil, err
	}
	for _, code := range result {
		if currencyPattern.MatchString(code) {
			codes[code] = true
		}
	}
	return codes, nil
}

func (app *application) createAccount(in input) (Account, error) {
	var account Account
	name, err := textField(in["name"], "Название", 80, true)
	if err != nil {
		return account, err
	}
	institution, err := textField(in["institution"], "Банк", 80, false)
	if err != nil {
		return account, err
	}
	kind := stringValue(in["type"])
	if in["type"] == nil {
		kind = "checking"
	}
	switch kind {
	case "checking", "savings", "cash", "investment", "other":
	default:
		return account, invalid("Неизвестный тип счёта")
	}
	id, err := uuid()
	if err != nil {
		return account, err
	}
	account = Account{ID: id, Name: name, Institution: institution, Type: kind, Currency: stringValue(in["currency"])}
	return account, transact(app.db, func(tx *sql.Tx) error {
		codes, err := availableCurrencies(tx)
		if err != nil {
			return err
		}
		if !codes[account.Currency] {
			return invalid("Выберите валюту из списка")
		}
		if _, err := tx.Exec("INSERT INTO accounts VALUES (?,?,?,?,?,NULL)", account.ID, account.Name, account.Institution, account.Currency, account.Type); err != nil {
			return err
		}
		return insertBalance(tx, account.ID, account.Currency, in)
	})
}

func balanceFields(in input, currency string) (date string, amount int64, note string, err error) {
	date, err = validDate(in["date"])
	if err != nil {
		return
	}
	amount, err = toMinor(in["amount"], currency)
	if err != nil {
		return
	}
	note, err = textField(in["note"], "Заметка", 500, false)
	return
}

func insertBalance(db database, id, currency string, in input) error {
	date, amount, note, err := balanceFields(in, currency)
	if err != nil {
		return err
	}
	_, err = db.Exec("INSERT INTO balances(account_id,date,amount,note,created_at) VALUES (?,?,?,?,?)", id, date, amount, note, timestamp())
	return err
}

func (app *application) recordBalance(id string, in input) error {
	return transact(app.db, func(tx *sql.Tx) error {
		var code string
		err := tx.QueryRow("SELECT currency FROM accounts WHERE id=? AND archived_at IS NULL", id).Scan(&code)
		if errors.Is(err, sql.ErrNoRows) {
			return invalid("Счёт не найден или в архиве")
		}
		if err != nil {
			return err
		}
		return insertBalance(tx, id, code, in)
	})
}

func (app *application) updateBalance(id int64, in input) error {
	return transact(app.db, func(tx *sql.Tx) error {
		var code string
		var archivedAt *string
		err := tx.QueryRow("SELECT currency,archived_at FROM balances JOIN accounts ON accounts.id=balances.account_id WHERE balances.id=?", id).Scan(&code, &archivedAt)
		if errors.Is(err, sql.ErrNoRows) {
			return invalid("Запись не найдена")
		}
		if err != nil {
			return err
		}
		date, amount, note, err := balanceFields(in, code)
		if err != nil {
			return err
		}
		if archivedAt != nil && date > *archivedAt {
			return invalid("Дата записи не может быть позже даты архивации счёта")
		}
		_, err = tx.Exec("UPDATE balances SET amount=?,date=?,note=? WHERE id=?", amount, date, note, id)
		return err
	})
}

func (app *application) deleteBalance(id int64) error {
	return transact(app.db, func(tx *sql.Tx) error {
		var account string
		err := tx.QueryRow("SELECT account_id FROM balances WHERE id=?", id).Scan(&account)
		if errors.Is(err, sql.ErrNoRows) {
			return invalid("Запись не найдена")
		}
		if err != nil {
			return err
		}
		var count int
		if err := tx.QueryRow("SELECT count(*) FROM balances WHERE account_id=?", account).Scan(&count); err != nil {
			return err
		}
		if count <= 1 {
			return invalid("Единственную запись счёта нельзя удалить. Её можно отредактировать.")
		}
		_, err = tx.Exec("DELETE FROM balances WHERE id=?", id)
		return err
	})
}

func (app *application) updateAccount(id string, in input) error {
	name, err := textField(in["name"], "Название", 80, true)
	if err != nil {
		return err
	}
	institution, err := textField(in["institution"], "Банк", 80, false)
	if err != nil {
		return err
	}
	return updateExisting(app.db, "Счёт не найден", "UPDATE accounts SET name=?,institution=? WHERE id=? AND archived_at IS NULL", name, institution, id)
}

func (app *application) archiveAccount(id string) error {
	return updateExisting(app.db, "Счёт не найден", "UPDATE accounts SET archived_at=? WHERE id=? AND archived_at IS NULL", today(), id)
}

func snapshotJSON(snapshot Snapshot) ([]byte, error) {
	if snapshot.Date == "" || len(snapshot.Rates) < 3 || snapshot.Rates["USD"] != 1 {
		return nil, invalid("Некорректные курсы провайдера")
	}
	if _, err := validDate(snapshot.Date); err != nil {
		return nil, err
	}
	for code, value := range snapshot.Rates {
		if !currencyPattern.MatchString(code) || value <= 0 || math.IsNaN(value) || math.IsInf(value, 0) {
			return nil, invalid("Некорректные курсы провайдера")
		}
	}
	return json.Marshal(snapshot)
}

func readExport(db database) (exportData, error) {
	out := exportData{Version: 1, ExportedAt: timestamp()}
	var err error
	if out.Base, err = setting(db, "base"); err != nil {
		return out, err
	}
	if out.Accounts, err = readAccounts(db); err != nil {
		return out, err
	}
	if out.Balances, err = readBalances(db); err != nil {
		return out, err
	}
	out.Rates, err = listRows(db, "SELECT payload FROM rates ORDER BY date", func(rows *sql.Rows) (Snapshot, error) {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			return Snapshot{}, err
		}
		return decodeSnapshot(raw)
	})
	return out, err
}

func (app *application) readExport() (exportData, error) {
	var out exportData
	err := transact(app.db, func(tx *sql.Tx) (err error) {
		out, err = readExport(tx)
		return
	})
	return out, err
}

type activeAccount struct {
	Account
	Amount float64  `json:"amount"`
	Date   string   `json:"date"`
	Value  *float64 `json:"value"`
}
type chartPoint struct {
	Date  string   `json:"date"`
	Total *float64 `json:"total"`
}
type changeSet struct {
	Total   *float64 `json:"total"`
	Balance *float64 `json:"balance"`
	FX      *float64 `json:"fx"`
}
type allocation struct {
	Currency    string   `json:"currency"`
	Amount      float64  `json:"amount"`
	Value       *float64 `json:"value"`
	Rate        *float64 `json:"rate"`
	InitialRate *float64 `json:"initialRate"`
	FX          *float64 `json:"fx"`
}
type quotePoint struct {
	Date     string   `json:"date"`
	Rate     *float64 `json:"rate"`
	RateDate *string  `json:"rateDate"`
}
type currencyHistory struct {
	Currency string       `json:"currency"`
	Points   []quotePoint `json:"points"`
}
type journalRow struct {
	balance
	Amount   float64 `json:"amount"`
	Name     string  `json:"name"`
	Currency string  `json:"currency"`
	Archived bool    `json:"archived"`
}
type dashboardData struct {
	Base       string            `json:"base"`
	Total      *float64          `json:"total"`
	Missing    []string          `json:"missing"`
	Accounts   []activeAccount   `json:"accounts"`
	Currencies []allocation      `json:"currencies"`
	History    []chartPoint      `json:"history"`
	Change     changeSet         `json:"change"`
	FXHistory  []currencyHistory `json:"fxHistory"`
	Rates      *Snapshot         `json:"rates"`
	RateError  *string           `json:"rateError"`
	Journal    []journalRow      `json:"journal"`
	Archived   []Account         `json:"archived"`
}

func (app *application) dashboard(now string) (dashboardData, error) {
	var data exportData
	var rateError *string
	err := transact(app.db, func(tx *sql.Tx) error {
		err := tx.QueryRow("SELECT value FROM settings WHERE key='rateError'").Scan(&rateError)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		data, err = readExport(tx)
		return err
	})
	if err != nil {
		return dashboardData{}, err
	}
	result := buildDashboard(data, now)
	result.RateError = rateError
	return result, nil
}

func snapshotAt(snapshots []Snapshot, date string) *Snapshot {
	index := sort.Search(len(snapshots), func(i int) bool { return snapshots[i].Date > date })
	if index == 0 {
		return nil
	}
	return &snapshots[index-1]
}
func rateMap(snapshot *Snapshot) map[string]float64 {
	if snapshot == nil {
		return nil
	}
	return snapshot.Rates
}
func dollars(value *float64) float64 {
	if value == nil {
		return 0
	}
	return *value
}
func delta(end, start *float64) *float64 {
	if end == nil || start == nil {
		return nil
	}
	return number(*end - *start)
}

func buildDashboard(data exportData, now string) dashboardData {
	out := dashboardData{Base: data.Base, Missing: []string{}, Accounts: []activeAccount{}, Currencies: []allocation{}, History: []chartPoint{}, FXHistory: []currencyHistory{}, Journal: []journalRow{}, Archived: []Account{}}
	accounts := map[string]Account{}
	histories := map[string][]balance{}
	for _, account := range data.Accounts {
		accounts[account.ID] = account
		if account.ArchivedAt != nil {
			out.Archived = append(out.Archived, account)
		}
	}
	for _, row := range data.Balances {
		histories[row.AccountID] = append(histories[row.AccountID], row)
	}
	for i := len(data.Balances) - 1; i >= 0; i-- {
		row := data.Balances[i]
		account := accounts[row.AccountID]
		out.Journal = append(out.Journal, journalRow{balance: row, Amount: fromMinor(row.Amount, account.Currency), Name: account.Name, Currency: account.Currency, Archived: account.ArchivedAt != nil})
	}
	if len(data.Rates) > 0 {
		out.Rates = &data.Rates[len(data.Rates)-1]
	}

	at := func(date string) ([]activeAccount, []string, *float64) {
		active := []activeAccount{}
		missing := []string{}
		seen := map[string]bool{}
		var sum float64
		rates := rateMap(snapshotAt(data.Rates, date))
		for _, account := range data.Accounts {
			if account.ArchivedAt != nil && *account.ArchivedAt <= date {
				continue
			}
			rows := histories[account.ID]
			index := sort.Search(len(rows), func(i int) bool { return rows[i].Date > date })
			if index == 0 {
				continue
			}
			row := rows[index-1]
			amount := fromMinor(row.Amount, account.Currency)
			value := convert(amount, account.Currency, data.Base, rates)
			active = append(active, activeAccount{Account: account, Amount: amount, Date: row.Date, Value: value})
			if value == nil && !seen[account.Currency] {
				seen[account.Currency] = true
				missing = append(missing, account.Currency)
			}
			sum += dollars(value)
		}
		if len(missing) > 0 {
			return active, missing, nil
		}
		return active, missing, number(sum)
	}

	out.Accounts, out.Missing, out.Total = at(now)
	start := now
	initialTotal := out.Total
	if len(data.Balances) > 0 {
		endDay, _ := time.Parse(dateFormat, now)
		start = max(data.Balances[0].Date, endDay.AddDate(0, 0, -365).Format(dateFormat))
		day, _ := time.Parse(dateFormat, start)
		for ; !day.After(endDay); day = day.AddDate(0, 0, 1) {
			date := day.Format(dateFormat)
			_, _, total := at(date)
			out.History = append(out.History, chartPoint{Date: date, Total: total})
		}
		if len(out.History) > 0 {
			initialTotal = out.History[0].Total
		} else {
			start = now
		}
	}

	initialRates := rateMap(snapshotAt(data.Rates, start))
	currentRates := rateMap(snapshotAt(data.Rates, now))
	complete := out.Total != nil && initialTotal != nil
	var constant float64
	byCurrency := map[string]int{}
	for _, account := range out.Accounts {
		initial := convert(account.Amount, account.Currency, data.Base, initialRates)
		complete = complete && initial != nil
		constant += dollars(initial)
		index, exists := byCurrency[account.Currency]
		if !exists {
			index = len(out.Currencies)
			byCurrency[account.Currency] = index
			out.Currencies = append(out.Currencies, allocation{Currency: account.Currency, Value: number(0)})
		}
		row := &out.Currencies[index]
		row.Amount += account.Amount
		if row.Value == nil || account.Value == nil {
			row.Value = nil
		} else {
			*row.Value += *account.Value
		}
	}
	if complete {
		out.Change = changeSet{Total: delta(out.Total, initialTotal), Balance: delta(&constant, initialTotal), FX: delta(out.Total, &constant)}
	}
	sort.SliceStable(out.Currencies, func(i, j int) bool { return dollars(out.Currencies[i].Value) > dollars(out.Currencies[j].Value) })
	for i := range out.Currencies {
		row := &out.Currencies[i]
		row.Rate = convert(1, row.Currency, data.Base, currentRates)
		row.InitialRate = convert(1, row.Currency, data.Base, initialRates)
		row.FX = delta(row.Value, convert(row.Amount, row.Currency, data.Base, initialRates))
		if row.Currency == data.Base {
			continue
		}
		quotes := currencyHistory{Currency: row.Currency, Points: []quotePoint{}}
		push := func(date string, snapshot *Snapshot) {
			point := quotePoint{Date: date, Rate: convert(1, row.Currency, data.Base, rateMap(snapshot))}
			if snapshot != nil {
				point.RateDate = &snapshot.Date
			}
			quotes.Points = append(quotes.Points, point)
		}
		if len(out.History) > 0 {
			push(start, snapshotAt(data.Rates, start))
			for j := range data.Rates {
				if snap := &data.Rates[j]; snap.Date > start && snap.Date <= now {
					push(snap.Date, snap)
				}
			}
		}
		out.FXHistory = append(out.FXHistory, quotes)
	}
	return out
}
