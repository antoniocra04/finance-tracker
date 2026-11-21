package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"svod/internal/web/spa"
)

type httpError struct {
	status int
	why    string
}

func (e httpError) Error() string { return e.why }
func invalid(why string) error    { return httpError{400, why} }

type application struct {
	db             *sql.DB
	bootstrapToken string
	secureCookie   bool
	origin         string
	fetch          func(context.Context) (Snapshot, error)
	static         http.Handler
	authMu         sync.Mutex
	attempts       map[string]attempt
	refreshMu      sync.Mutex
}

func newApplication(dbPath, bootstrap string, secure bool, origin string, fetch func(context.Context) (Snapshot, error)) (*application, error) {
	db, err := openStore(dbPath)
	if err != nil {
		return nil, err
	}
	if fetch == nil {
		fetch = fetchLiveRates
	}
	return &application{db: db, bootstrapToken: bootstrap, secureCookie: secure, origin: origin, fetch: fetch, attempts: map[string]attempt{}, static: spa.Handler()}, nil
}

func readInput(w http.ResponseWriter, r *http.Request) (input, error) {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		return nil, httpError{415, "Ожидается JSON"}
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16384))
	decoder.UseNumber()
	var result input
	err := decoder.Decode(&result)
	if err == nil && result != nil {
		var extra any
		err = decoder.Decode(&extra)
		if err == io.EOF {
			return result, nil
		}
	}
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		return nil, httpError{413, "Слишком большой запрос"}
	}
	return nil, invalid("Некорректный JSON")
}

func respond(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	body, err := json.Marshal(data)
	if err != nil {
		log.Printf("JSON: %v", err)
		status = http.StatusInternalServerError
		body = []byte(`{"error":"Ошибка сервера. Проверьте журнал."}`)
	}
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

func respondError(w http.ResponseWriter, err error) {
	var failure httpError
	if !errors.As(err, &failure) {
		log.Printf("Request failed: %v", err)
		failure = httpError{500, "Ошибка сервера. Проверьте журнал."}
	}
	respond(w, failure.status, map[string]string{"error": failure.why})
}

func (app *application) authorizedOrigin(r *http.Request) bool {
	expected := app.origin
	if expected == "" {
		scheme := "http"
		if app.secureCookie {
			scheme = "https"
		}
		expected = scheme + "://" + r.Host
	}
	return r.Header.Get("Origin") == expected && r.Header.Get("Sec-Fetch-Site") != "cross-site"
}

var (
	accountRoute = regexp.MustCompile(`^/api/accounts/([a-f0-9-]{36})(?:/(balances|archive))?$`)
	balanceRoute = regexp.MustCompile(`^/api/balances/([1-9][0-9]*)$`)
)

func (app *application) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'")
	if !strings.HasPrefix(r.URL.Path, "/api/") {
		app.static.ServeHTTP(w, r)
		return
	}
	if r.Method != "GET" && r.Method != "HEAD" && !app.authorizedOrigin(r) {
		respondError(w, httpError{403, "Запрос с другого сайта отклонён"})
		return
	}
	status, data, err := app.api(w, r)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, status, data)
}

var success = map[string]bool{"ok": true}

func (app *application) api(w http.ResponseWriter, r *http.Request) (int, any, error) {
	path, method := r.URL.Path, r.Method
	if method == "POST" && (path == "/api/setup" || path == "/api/login") {
		return 200, success, app.authenticate(w, r, path == "/api/setup")
	}
	token, err := app.session(r)
	if err != nil {
		return 0, nil, err
	}
	if path == "/api/session" && method == "GET" {
		stored, err := setting(app.db, "password")
		data := map[string]any{"initialized": stored != "", "authenticated": token != ""}
		if stored == "" {
			data["base"] = "RUB"
		}
		return 200, data, err
	}
	if token == "" {
		return 0, nil, httpError{401, "Войдите в приложение"}
	}

	switch {
	case method == "GET" && path == "/api/data":
		data, err := app.dashboard(today())
		return 200, data, err
	case method == "GET" && path == "/api/export":
		data, err := app.readExport()
		if err == nil {
			w.Header().Set("Content-Disposition", `attachment; filename="svod-export.json"`)
		}
		return 200, data, err
	case method == "GET" && path == "/api/currencies":
		data, err := app.currencyCatalog()
		return 200, data, err
	case method == "POST" && path == "/api/logout":
		_, err := app.db.Exec("DELETE FROM sessions WHERE token=?", token)
		if err == nil {
			http.SetCookie(w, sessionCookie("", -1, app.secureCookie))
		}
		return 200, success, err
	case method == "POST" && path == "/api/accounts":
		in, err := readInput(w, r)
		if err != nil {
			return 0, nil, err
		}
		data, err := app.createAccount(in)
		return 201, data, err
	case method == "PUT" && path == "/api/settings":
		in, err := readInput(w, r)
		if err != nil {
			return 0, nil, err
		}
		codes, err := availableCurrencies(app.db)
		if err != nil {
			return 0, nil, err
		}
		base := stringValue(in["base"])
		if !codes[base] {
			return 0, nil, invalid("Неизвестная валюта")
		}
		return 200, success, app.setSetting("base", base)
	case method == "PUT" && path == "/api/password":
		in, err := readInput(w, r)
		if err != nil {
			return 0, nil, err
		}
		return 200, success, app.changePassword(in)
	case method == "POST" && path == "/api/rates/refresh":
		if _, err := readInput(w, r); err != nil {
			return 0, nil, err
		}
		if err := app.refreshRates(r.Context()); err != nil {
			return 0, nil, err
		}
		message, err := setting(app.db, "rateError")
		data := map[string]any{"ok": true, "error": nil}
		if message != "" {
			data["error"] = message
		}
		return 200, data, err
	}
	if capture := balanceRoute.FindStringSubmatch(path); capture != nil {
		id, err := strconv.ParseInt(capture[1], 10, 64)
		if err != nil || id > 9007199254740991 {
			return 0, nil, invalid("Некорректный номер записи")
		}
		if method != "PATCH" && method != "DELETE" {
			return 0, nil, httpError{405, "Метод не поддерживается"}
		}
		in, err := readInput(w, r)
		if err != nil {
			return 0, nil, err
		}
		if method == "DELETE" {
			return 200, success, app.deleteBalance(id)
		}
		return 200, success, app.updateBalance(id, in)
	}
	if capture := accountRoute.FindStringSubmatch(path); capture != nil {
		id, action := capture[1], capture[2]
		switch {
		case method == "POST" && action == "balances":
			in, err := readInput(w, r)
			if err != nil {
				return 0, nil, err
			}
			return 200, success, app.recordBalance(id, in)
		case method == "POST" && action == "archive":
			if _, err := readInput(w, r); err != nil {
				return 0, nil, err
			}
			return 200, success, app.archiveAccount(id)
		case method == "PATCH" && action == "":
			in, err := readInput(w, r)
			if err != nil {
				return 0, nil, err
			}
			return 200, success, app.updateAccount(id, in)
		default:
			return 0, nil, httpError{405, "Метод не поддерживается"}
		}
	}
	return 0, nil, httpError{404, "Не найдено"}
}

type currencyOption struct {
	Code      string `json:"code"`
	Supported bool   `json:"supported"`
}

func (app *application) currencyCatalog() ([]currencyOption, error) {
	result := []currencyOption{}
	err := transact(app.db, func(tx *sql.Tx) error {
		codes, err := availableCurrencies(tx)
		if err != nil {
			return err
		}
		latest, err := latestRates(tx)
		if err != nil {
			return err
		}
		rates := rateMap(latest)
		for code := range codes {
			result = append(result, currencyOption{Code: code, Supported: code == "USD" || rates[code] > 0})
		}
		return nil
	})
	sort.Slice(result, func(i, j int) bool { return result[i].Code < result[j].Code })
	return result, err
}

func fetchLiveRates(ctx context.Context) (Snapshot, error) {
	request, err := http.NewRequestWithContext(ctx, "GET", "https://open.er-api.com/v6/latest/USD", nil)
	if err != nil {
		return Snapshot{}, err
	}
	request.Header.Set("Accept", "application/json")
	client := http.Client{Timeout: 12 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return Snapshot{}, err
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return Snapshot{}, errors.New("rate provider HTTP " + response.Status)
	}
	var data struct {
		Result string             `json:"result"`
		Base   string             `json:"base_code"`
		Last   int64              `json:"time_last_update_unix"`
		Next   int64              `json:"time_next_update_unix"`
		Rates  map[string]float64 `json:"rates"`
	}
	err = json.NewDecoder(io.LimitReader(response.Body, 512<<10)).Decode(&data)
	if err != nil {
		return Snapshot{}, err
	}
	if data.Result != "success" || data.Base != "USD" || data.Last <= 0 || data.Next <= 0 {
		return Snapshot{}, errors.New("invalid rate response")
	}
	updated := time.Unix(data.Last, 0).UTC()
	return Snapshot{Date: updated.Format(dateFormat), UpdatedAt: updated.Format(isoFormat), NextUpdate: time.Unix(data.Next, 0).UTC().Format(isoFormat), Rates: data.Rates}, nil
}

func (app *application) refreshRates(ctx context.Context) error {
	app.refreshMu.Lock()
	defer app.refreshMu.Unlock()
	if err := ctx.Err(); err != nil {
		return err
	}
	latest, err := latestRates(app.db)
	if err != nil {
		return err
	}
	retry, err := setting(app.db, "rateRetryAt")
	if err != nil {
		return err
	}
	retryAt, _ := strconv.ParseInt(retry, 10, 64)
	now := time.Now()
	if retryAt > now.UnixMilli() {
		return nil
	}
	if latest != nil {
		next, err := time.Parse(time.RFC3339, latest.NextUpdate)
		if err == nil && next.After(now) {
			return nil
		}
	}
	snapshot, err := app.fetch(ctx)
	var payload []byte
	if err == nil {
		payload, err = snapshotJSON(snapshot)
	}
	if ctx.Err() != nil {
		return ctx.Err()
	}
	if err != nil {
		return transact(app.db, func(tx *sql.Tx) error {
			if err := setSetting(tx, "rateError", "Не удалось обновить курсы. Повторим через час."); err != nil {
				return err
			}
			return setSetting(tx, "rateRetryAt", strconv.FormatInt(time.Now().Add(time.Hour).UnixMilli(), 10))
		})
	}
	return transact(app.db, func(tx *sql.Tx) error {
		if _, err := tx.Exec("INSERT OR REPLACE INTO rates VALUES (?,?)", snapshot.Date, string(payload)); err != nil {
			return err
		}
		if err := setSetting(tx, "rateError", ""); err != nil {
			return err
		}
		return setSetting(tx, "rateRetryAt", "0")
	})
}
