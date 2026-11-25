package spa

import (
	"bytes"
	"embed"
	"net/http"
	"strings"
	"time"
)

//go:embed public
var files embed.FS

func Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.NotFound(w, r)
			return
		}
		name := strings.TrimPrefix(r.URL.Path, "/")
		switch name {
		case "":
			name = "index.html"
		case "accounts", "history", "analytics", "settings":
			http.Redirect(w, r, "/#"+name, http.StatusTemporaryRedirect)
			return
		case "app.js", "chart.mjs", "fx.mjs", "styles.css", "icon.svg":
		default:
			http.NotFound(w, r)
			return
		}
		data, err := files.ReadFile("public/" + name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		if strings.HasSuffix(name, ".js") || strings.HasSuffix(name, ".mjs") {
			w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
		}
		http.ServeContent(w, r, name, time.Time{}, bytes.NewReader(data))
	})
}
