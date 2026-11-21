package main

import (
	"database/sql"
	"errors"
	"net/url"
	"os"
	"path/filepath"
)

func sourceDB(path string) (*sql.DB, error) {
	path, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	if _, err := os.Stat(path); err != nil {
		return nil, err
	}
	uri := url.URL{Scheme: "file", Path: path, RawQuery: "mode=ro"}
	db, err := sql.Open("sqlite", uri.String())
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec("PRAGMA busy_timeout=5000"); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func backupDatabase(source, target string) error {
	db, err := sourceDB(source)
	if err != nil {
		return err
	}
	defer db.Close()
	if err := os.MkdirAll(filepath.Dir(target), 0700); err != nil {
		return err
	}
	file, err := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	if err := file.Close(); err != nil {
		os.Remove(target)
		return err
	}
	if _, err := db.Exec("VACUUM INTO ?", target); err != nil {
		os.Remove(target)
		return err
	}
	return nil
}

func restoreDatabase(source, target string) error {
	sourceInfo, err := os.Stat(source)
	if err != nil {
		return err
	}
	targetInfo, err := os.Stat(target)
	if err == nil && os.SameFile(sourceInfo, targetInfo) {
		return errors.New("нельзя восстановить базу из неё самой")
	}
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	db, err := sourceDB(source)
	if err != nil {
		return err
	}
	defer db.Close()

	var integrity string
	if err := db.QueryRow("PRAGMA integrity_check").Scan(&integrity); err != nil {
		return err
	}
	if integrity != "ok" {
		return errors.New("копия повреждена")
	}
	var count int
	if err := db.QueryRow("SELECT count(*) FROM sqlite_master WHERE type='table' AND name IN ('accounts','balances','rates','settings','sessions')").Scan(&count); err != nil {
		return err
	}
	if count != 5 {
		return errors.New("это не резервная копия Свода")
	}

	if err := os.MkdirAll(filepath.Dir(target), 0700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(target), ".svod-restore-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if err := tmp.Close(); err != nil {
		return err
	}
	if _, err := db.Exec("VACUUM INTO ?", tmp.Name()); err != nil {
		return err
	}
	replacement, err := sql.Open("sqlite", tmp.Name())
	if err != nil {
		return err
	}
	_, writeErr := replacement.Exec("DELETE FROM sessions; PRAGMA journal_mode=DELETE")
	closeErr := replacement.Close()
	if writeErr != nil {
		return writeErr
	}
	if closeErr != nil {
		return closeErr
	}

	// The server holds an advisory lock through the CLI while accessing the live
	// file. Restore runs with the same lock and discards stale SQLite sidecars.
	for _, suffix := range []string{"-wal", "-shm"} {
		if err := os.Remove(target + suffix); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}
	return os.Rename(tmp.Name(), target)
}
