package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func fixture(t *testing.T, path string, fetch func(context.Context) (Snapshot, error)) *application {
	t.Helper()
	app, err := newApplication(path, "test-bootstrap-token", false, "", fetch)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { app.db.Close() })
	return app
}

type testClient struct {
	t      *testing.T
	app    *application
	cookie string
}

func (c *testClient) call(method, url string, body any, want int) map[string]any {
	c.t.Helper()
	data, _ := json.Marshal(body)
	req := httptest.NewRequest(method, "http://svod.test/api"+url, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://svod.test")
	if c.cookie != "" {
		req.Header.Set("Cookie", c.cookie)
	}
	r := httptest.NewRecorder()
	c.app.ServeHTTP(r, req)
	if cstr := r.Header().Get("Set-Cookie"); cstr != "" {
		c.cookie = strings.SplitN(cstr, ";", 2)[0]
	}
	if r.Code != want {
		c.t.Fatalf("%s %s: status %d, want %d: %s", method, url, r.Code, want, r.Body.String())
	}
	var output map[string]any
	if err := json.Unmarshal(r.Body.Bytes(), &output); err != nil {
		c.t.Fatal(err)
	}
	return output
}

func TestAPIAccountHistoryAndPassword(t *testing.T) {
	app := fixture(t, ":memory:", nil)
	c := testClient{t: t, app: app}
	c.call("GET", "/data", nil, 401)
	c.call("POST", "/setup", map[string]any{"token": "wrong", "password": "длинный-пароль-123"}, 403)
	c.call("POST", "/setup", map[string]any{"token": "test-bootstrap-token", "password": "short"}, 400)
	c.call("POST", "/setup", map[string]any{"token": "test-bootstrap-token", "password": "длинный-пароль-123"}, 200)
	c.call("POST", "/setup", map[string]any{"token": "test-bootstrap-token", "password": "длинный-пароль-123"}, 409)
	id := c.call("POST", "/accounts", map[string]any{"name": "Cash", "currency": "JPY", "amount": "100", "date": "2026-10-20"}, 201)["id"].(string)
	c.call("POST", "/accounts/"+id+"/balances", map[string]any{"amount": "2.1"}, 400)
	c.call("POST", "/accounts/"+id+"/balances", map[string]any{"amount": "200", "date": "2026-10-21"}, 200)
	c.call("PUT", "/settings", map[string]any{"base": "JPY"}, 200)
	d := c.call("GET", "/data", nil, 200)
	if d["total"] != float64(200) {
		t.Fatal(d["total"])
	}
	req := httptest.NewRequest("POST", "http://svod.test/api/accounts", strings.NewReader("{}"))
	req.Header.Set("Origin", "https://example.org")
	req.Header.Set("Cookie", c.cookie)
	rec := httptest.NewRecorder()
	app.ServeHTTP(rec, req)
	if rec.Code != 403 {
		t.Fatal(rec.Code)
	}
	c.call("PATCH", "/balances/2", map[string]any{"amount": "300", "date": "2026-10-21"}, 200)
	c.call("DELETE", "/balances/2", map[string]any{}, 200)
	c.call("DELETE", "/balances/1", map[string]any{}, 400)
	if got := c.call("GET", "/data", nil, 200)["total"]; got != float64(100) {
		t.Fatal(got)
	}
	c.call("POST", "/accounts/"+id+"/archive", map[string]any{}, 200)
	if got := c.call("GET", "/data", nil, 200)["total"]; got != float64(0) {
		t.Fatal(got)
	}
	exp := c.call("GET", "/export", nil, 200)
	if len(exp["balances"].([]any)) != 1 || exp["password"] != nil {
		t.Fatal(exp)
	}
	c.call("PUT", "/password", map[string]any{"current": "длинный-пароль-123", "password": "new-password-123"}, 200)
	c.call("GET", "/data", nil, 401)
	c.call("POST", "/login", map[string]any{"password": "new-password-123"}, 200)
}

func TestScheduledRatesKeepLastKnownQuotes(t *testing.T) {
	calls := 0
	quotes := Snapshot{Date: "2026-10-21", Rates: map[string]float64{"USD": 1, "RUB": 100, "KZT": 500}, NextUpdate: time.Now().Add(time.Hour).UTC().Format(time.RFC3339)}
	app := fixture(t, ":memory:", func(ctx context.Context) (Snapshot, error) { calls++; return quotes, nil })
	if err := app.refreshRates(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := app.refreshRates(context.Background()); err != nil {
		t.Fatal(err)
	}
	if calls != 1 {
		t.Fatalf("provider called %d times", calls)
	}
	if err := app.setSetting("base", "RUB"); err != nil {
		t.Fatal(err)
	}
	id, err := app.createAccount(input{"name": "Dollar account", "currency": "USD", "amount": "12", "date": "2026-10-20"})
	if err != nil || id.ID == "" {
		t.Fatal(id, err)
	}
	d, err := app.dashboard("2026-10-22")
	if err != nil {
		t.Fatal(err)
	}
	if d.Total == nil || *d.Total != 1200 || d.History[0].Total != nil || d.FXHistory[0].Points[0].Rate != nil || d.Change.FX != nil {
		t.Fatalf("incorrect history %+v", d)
	}
}

func TestBackupIncludesWALAndRestoreClearsSessions(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "live.sqlite")
	copyPath := filepath.Join(dir, "backup.sqlite")
	app := fixture(t, path, nil)
	if _, err := app.createAccount(input{"name": "Saved", "currency": "RUB", "amount": "123.45"}); err != nil {
		t.Fatal(err)
	}
	if _, err := app.db.Exec("INSERT INTO sessions VALUES (?,?)", "session", time.Now().Add(time.Hour).UnixMilli()); err != nil {
		t.Fatal(err)
	}
	if err := backupDatabase(path, copyPath); err != nil {
		t.Fatal(err)
	}
	if err := backupDatabase(path, copyPath); err == nil {
		t.Fatal("overwrote an existing backup")
	}
	app.db.Close()
	if err := restoreDatabase(copyPath, path); err != nil {
		t.Fatal(err)
	}
	restored := fixture(t, path, nil)
	d, err := restored.dashboard(today())
	if err != nil || d.Total == nil || *d.Total != 123.45 {
		t.Fatalf("%+v %v", d, err)
	}
	var sessions int
	if err := restored.db.QueryRow("SELECT count(*) FROM sessions").Scan(&sessions); err != nil || sessions != 0 {
		t.Fatal(sessions, err)
	}
}

func TestLegacyNodePasswordAndSession(t *testing.T) {
	app := fixture(t, ":memory:", nil)
	// Output of Node crypto.scryptSync with a UTF-8 password and the legacy
	// string salt. It is intentionally independent of the Go hash writer.
	const oldHash = "0123456789abcdef0123456789abcdef0123456789abcdef:ca802e5c583763f79b11f049367c2a65e3882888b0c33af621a98fed8fe7559d05e15e2d386bd25f1eee189a5738dce718923747286a296bcf2d61942ec4c335"
	if err := app.setSetting("password", oldHash); err != nil {
		t.Fatal(err)
	}
	const oldToken = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
	const oldTokenHash = "35ab52a17f6ba835f9243d9fd1549534ff663ce66f30660022f47c004be622bd"
	if _, err := app.db.Exec("INSERT INTO sessions VALUES (?,?)", oldTokenHash, time.Now().Add(time.Hour).UnixMilli()); err != nil {
		t.Fatal(err)
	}
	c := testClient{t: t, app: app, cookie: "svod_session=" + oldToken}
	c.call("GET", "/data", nil, 200)
	c.cookie = ""
	c.call("POST", "/login", map[string]any{"password": "длинный-пароль-123"}, 200)
	if _, err := app.db.Exec("UPDATE sessions SET expires=0"); err != nil {
		t.Fatal(err)
	}
	c.call("GET", "/data", nil, 401)
}

func TestProviderFailureKeepsRatesAndBacksOff(t *testing.T) {
	calls := 0
	app := fixture(t, ":memory:", func(context.Context) (Snapshot, error) {
		calls++
		return Snapshot{Date: today(), Rates: map[string]float64{"USD": 1, "RUB": -1, "KZT": 500}}, nil
	})
	snapshot := Snapshot{Date: "2026-10-20", Rates: map[string]float64{"USD": 1, "RUB": 100, "KZT": 500}}
	payload, err := snapshotJSON(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := app.db.Exec("INSERT INTO rates VALUES (?,?)", snapshot.Date, string(payload)); err != nil {
		t.Fatal(err)
	}
	if err := app.refreshRates(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := app.refreshRates(context.Background()); err != nil {
		t.Fatal(err)
	}
	last, err := latestRates(app.db)
	if err != nil || last == nil || last.Rates["RUB"] != 100 || calls != 1 {
		t.Fatal(last, calls, err)
	}
	if message, err := setting(app.db, "rateError"); err != nil || message == "" {
		t.Fatal(message, err)
	}
}

func TestCorrectionsAndFXDecomposition(t *testing.T) {
	app := fixture(t, ":memory:", nil)
	usd, err := app.createAccount(input{"name": "USD", "currency": "USD", "amount": "100", "date": "2026-10-20"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := app.createAccount(input{"name": "RUB", "currency": "RUB", "amount": "200", "date": "2026-10-20"}); err != nil {
		t.Fatal(err)
	}

	for _, rates := range []Snapshot{
		{Date: "2026-10-20", Rates: map[string]float64{"USD": 1, "RUB": 100, "KZT": 500}},
		{Date: "2026-10-22", Rates: map[string]float64{"USD": 1, "RUB": 90, "KZT": 400}},
	} {
		payload, err := snapshotJSON(rates)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := app.db.Exec("INSERT INTO rates VALUES (?,?)", rates.Date, string(payload)); err != nil {
			t.Fatal(err)
		}
	}
	for _, amount := range []string{"120", "130"} {
		if err := app.recordBalance(usd.ID, input{"amount": amount, "date": "2026-10-21"}); err != nil {
			t.Fatal(err)
		}
	}
	if err := app.updateBalance(3, input{"amount": "900", "date": "2026-10-21", "note": "Corrected old row"}); err != nil {
		t.Fatal(err)
	}
	d, err := app.dashboard("2026-10-22")
	if err != nil {
		t.Fatal(err)
	}
	if dollars(d.Total) != 11900 || dollars(d.Change.Balance) != 3000 || dollars(d.Change.FX) != -1300 ||
		d.Currencies[0].Currency != "USD" || dollars(d.Currencies[0].FX) != -1300 || d.Journal[1].Note != "Corrected old row" {
		t.Fatalf("%+v", d)
	}
	if err := app.deleteBalance(4); err != nil {
		t.Fatal(err)
	}
	d, err = app.dashboard("2026-10-22")
	if err != nil || dollars(d.Total) != 81200 {
		t.Fatal(d.Total, err)
	}
	if _, err := app.db.Exec("UPDATE accounts SET archived_at=? WHERE id=?", "2026-10-22", usd.ID); err != nil {
		t.Fatal(err)
	}
	if err := app.updateBalance(3, input{"amount": "3", "date": "2026-10-23"}); err == nil {
		t.Fatal("accepted a post-archive edit")
	}
	if err := app.updateBalance(3, input{"amount": "3", "date": "2026-10-22"}); err != nil {
		t.Fatal(err)
	}
	d, err = app.dashboard("2026-10-22")
	if err != nil || dollars(d.Total) != 200 || len(d.Archived) != 1 {
		t.Fatal(d, err)
	}
}
