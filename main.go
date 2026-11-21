package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	_ "time/tzdata"
)

func envDefault(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func lockDatabase(path string) (*os.File, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, err
	}
	file, err := os.OpenFile(path+".lock", os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return nil, err
	}
	if err := syscall.Flock(int(file.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		file.Close()
		return nil, fmt.Errorf("база используется, сначала остановите Свод: %w", err)
	}
	return file, nil
}

func run(args []string) error {
	syscall.Umask(0077)
	path := envDefault("DB_PATH", "data/svod.sqlite")
	host := envDefault("HOST", "127.0.0.1")
	port := envDefault("PORT", "3000")
	if len(args) > 0 {
		switch args[0] {
		case "backup":
			if len(args) > 2 {
				return errors.New("использование: svod backup [путь-к-копии.sqlite]")
			}
			target := "backups/svod-" + strings.ReplaceAll(timestamp(), ":", "-") + ".sqlite"
			if len(args) == 2 {
				target = args[1]
			}
			if err := backupDatabase(path, target); err != nil {
				return err
			}
			fmt.Printf("Резервная копия: %s\n", target)
			return nil
		case "restore":
			if len(args) != 2 {
				return errors.New("использование: svod restore путь-к-копии.sqlite")
			}
			lock, err := lockDatabase(path)
			if err != nil {
				return err
			}
			defer lock.Close()
			if err := restoreDatabase(args[1], path); err != nil {
				return err
			}
			fmt.Printf("База восстановлена: %s. Все сессии завершены.\n", path)
			return nil
		case "healthcheck":
			client := http.Client{Timeout: 3 * time.Second}
			response, err := client.Get("http://127.0.0.1:" + port + "/api/session")
			if err != nil {
				return err
			}
			defer response.Body.Close()
			if response.StatusCode != http.StatusOK {
				return errors.New(response.Status)
			}
			return nil
		default:
			return errors.New("использование: svod [backup|restore|healthcheck]")
		}
	}
	lock, err := lockDatabase(path)
	if err != nil {
		return err
	}
	defer lock.Close()
	bootstrap := os.Getenv("BOOTSTRAP_TOKEN")
	if bootstrap == "" {
		bootstrap, err = randomHex(16)
		if err != nil {
			return err
		}
	}
	app, err := newApplication(path, bootstrap, os.Getenv("SECURE_COOKIE") == "true", os.Getenv("APP_ORIGIN"), nil)
	if err != nil {
		return err
	}
	defer app.db.Close()
	stored, err := setting(app.db, "password")
	if err != nil {
		return err
	}
	if stored == "" {
		log.Printf("Код первой установки: %s", bootstrap)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	schedulerDone := make(chan struct{})
	go func() {
		defer close(schedulerDone)
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for {
			if err := app.refreshRates(ctx); err != nil && ctx.Err() == nil {
				log.Printf("Rates refresh: %v", err)
			}
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()

	server := &http.Server{Addr: net.JoinHostPort(host, port), Handler: app, ReadHeaderTimeout: 15 * time.Second, ReadTimeout: 20 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}
	serverDone := make(chan error, 1)
	go func() { serverDone <- server.ListenAndServe() }()
	log.Printf("Свод: http://%s", server.Addr)
	select {
	case err := <-serverDone:
		stop()
		<-schedulerDone
		return err
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		err := server.Shutdown(shutdown)
		<-schedulerDone
		return err
	}
}

func main() {
	if err := run(os.Args[1:]); err != nil {
		log.Fatal(err)
	}
}
