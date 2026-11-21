package main

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/scrypt"
)

type attempt struct {
	count int
	until time.Time
}

func randomHex(size int) (string, error) {
	data := make([]byte, size)
	if _, err := rand.Read(data); err != nil {
		return "", err
	}
	return hex.EncodeToString(data), nil
}

func uuid() (string, error) {
	var data [16]byte
	if _, err := rand.Read(data[:]); err != nil {
		return "", err
	}
	data[6] = (data[6] & 0x0f) | 0x40
	data[8] = (data[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", data[:4], data[4:6], data[6:8], data[8:10], data[10:]), nil
}

func tokenHash(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

func tokensMatch(left, right string) bool {
	a, b := sha256.Sum256([]byte(left)), sha256.Sum256([]byte(right))
	return subtle.ConstantTimeCompare(a[:], b[:]) == 1
}

// Node's scrypt() defaults to N=16384, r=8, p=1. The stored salt is used as
// literal hex text rather than decoded, preserving existing passwords exactly.
func deriveKey(password, salt string) ([]byte, error) {
	return scrypt.Key([]byte(password), []byte(salt), 1<<14, 8, 1, 64)
}

func newPasswordHash(value any) (string, error) {
	password := stringValue(value)
	if length := stringLength(password); length < 12 || length > 256 {
		return "", invalid("Пароль: от 12 до 256 символов")
	}
	salt, err := randomHex(24)
	if err != nil {
		return "", err
	}
	key, err := deriveKey(password, salt)
	if err != nil {
		return "", err
	}
	return salt + ":" + hex.EncodeToString(key), nil
}

func verifyPassword(value any, stored string) (bool, error) {
	password, ok := value.(string)
	if !ok || stringLength(password) > 256 {
		return false, nil
	}
	salt, expected, ok := strings.Cut(stored, ":")
	if !ok {
		salt, expected = strings.Repeat("0", 48), strings.Repeat("0", 128)
	}
	key, err := deriveKey(password, salt)
	if err != nil {
		return false, err
	}
	hash, err := hex.DecodeString(expected)
	return err == nil && stored != "" && subtle.ConstantTimeCompare(key, hash) == 1, nil
}

func sessionCookie(value string, maxAge int, secure bool) *http.Cookie {
	return &http.Cookie{Name: "svod_session", Value: value, Path: "/", HttpOnly: true, SameSite: http.SameSiteStrictMode, Secure: secure, MaxAge: maxAge}
}

func (app *application) session(req *http.Request) (string, error) {
	cookie, err := req.Cookie("svod_session")
	if err != nil || len(cookie.Value) != 64 {
		return "", nil
	}
	if _, err := hex.DecodeString(cookie.Value); err != nil {
		return "", nil
	}
	var token string
	err = app.db.QueryRow("SELECT token FROM sessions WHERE token=? AND expires>?", tokenHash(cookie.Value), time.Now().UnixMilli()).Scan(&token)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return token, err
}

func writeSession(tx *sql.Tx, now time.Time, token string) error {
	if _, err := tx.Exec("DELETE FROM sessions WHERE expires<?", now.UnixMilli()); err != nil {
		return err
	}
	_, err := tx.Exec("INSERT INTO sessions VALUES (?,?)", tokenHash(token), now.Add(7*24*time.Hour).UnixMilli())
	return err
}

func (app *application) authenticate(w http.ResponseWriter, r *http.Request, setup bool) error {
	in, err := readInput(w, r)
	if err != nil {
		return err
	}
	address, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		address = r.RemoteAddr
	}
	app.authMu.Lock()
	defer app.authMu.Unlock()
	now := time.Now()
	for address, saved := range app.attempts {
		if !saved.until.After(now) {
			delete(app.attempts, address)
		}
	}
	current, ok := app.attempts[address]
	if !ok {
		current = attempt{until: now.Add(15 * time.Minute)}
	}
	if current.count >= 5 {
		return httpError{429, "Слишком много попыток. Подождите 15 минут."}
	}
	current.count++
	app.attempts[address] = current

	stored, err := setting(app.db, "password")
	if err != nil {
		return err
	}
	if setup {
		if stored != "" {
			return httpError{409, "Пароль уже установлен"}
		}
		if app.bootstrapToken == "" || !tokensMatch(stringValue(in["token"]), app.bootstrapToken) {
			return httpError{403, "Неверный код установки"}
		}
		stored, err = newPasswordHash(in["password"])
		if err != nil {
			return err
		}
	} else {
		ok, err := verifyPassword(in["password"], stored)
		if err != nil {
			return err
		}
		if !ok {
			return httpError{401, "Неверный пароль"}
		}
	}
	token, err := randomHex(32)
	if err != nil {
		return err
	}
	err = transact(app.db, func(tx *sql.Tx) error {
		if setup {
			if err := setSetting(tx, "password", stored); err != nil {
				return err
			}
		}
		return writeSession(tx, now, token)
	})
	if err != nil {
		return err
	}
	delete(app.attempts, address)
	http.SetCookie(w, sessionCookie(token, 7*86400, app.secureCookie))
	return nil
}

func (app *application) changePassword(in input) error {
	app.authMu.Lock()
	defer app.authMu.Unlock()
	stored, err := setting(app.db, "password")
	if err != nil {
		return err
	}
	ok, err := verifyPassword(in["current"], stored)
	if err != nil {
		return err
	}
	if !ok {
		return httpError{403, "Текущий пароль неверен"}
	}
	replacement, err := newPasswordHash(in["password"])
	if err != nil {
		return err
	}
	return transact(app.db, func(tx *sql.Tx) error {
		if err := setSetting(tx, "password", replacement); err != nil {
			return err
		}
		_, err := tx.Exec("DELETE FROM sessions")
		return err
	})
}
