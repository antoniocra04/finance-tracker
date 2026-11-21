package spa

import (
	"bytes"
	"embed"
	"io/fs"
	"net/http"
	"strings"
	"time"
)

//go:embed all:static
var files embed.FS

func Handler() http.Handler {
	content, _ := fs.Sub(files, "static/generated")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.NotFound(w, r)
			return
		}
		name := strings.TrimPrefix(r.URL.Path, "/")
		switch name {
		case "", "accounts", "history", "analytics", "settings":
			name = "index.html"
		default:
			if name != "icon.svg" && !strings.HasPrefix(name, "assets/") {
				http.NotFound(w, r)
				return
			}
		}
		if !fs.ValidPath(name) {
			http.NotFound(w, r)
			return
		}
		data, err := fs.ReadFile(content, name)
		if err != nil {
			if name == "index.html" {
				http.Error(w, "Сначала соберите интерфейс", http.StatusServiceUnavailable)
			} else {
				http.NotFound(w, r)
			}
			return
		}
		http.ServeContent(w, r, name, time.Time{}, bytes.NewReader(data))
	})
}
