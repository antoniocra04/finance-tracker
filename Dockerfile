FROM --platform=$BUILDPLATFORM node:24-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
COPY frontend/vendor ./vendor
RUN npm ci --no-audit --no-fund
COPY frontend/index.html frontend/tsconfig.json frontend/vite.config.ts ./
COPY frontend/public ./public
COPY frontend/src ./src
RUN npm run build

FROM --platform=$BUILDPLATFORM golang:1.26.11-alpine AS build
ARG TARGETOS
ARG TARGETARCH
WORKDIR /src
ENV GOTOOLCHAIN=local
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
COPY internal/web/spa/spa.go ./internal/web/spa/
COPY --from=frontend /src/internal/web/spa/static/generated ./internal/web/spa/static/generated
RUN CGO_ENABLED=0 GOOS="$TARGETOS" GOARCH="$TARGETARCH" go build -mod=readonly -trimpath -ldflags="-s -w" -o /out/svod .

FROM alpine:3.23
ENV HOST=0.0.0.0 PORT=3000 DB_PATH=/app/data/svod.sqlite
WORKDIR /app
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /out/svod /app/svod
RUN mkdir -p /app/data /app/backups \
 && chown 1000:1000 /app/data /app/backups \
 && chmod 0700 /app/data /app/backups
USER 1000:1000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD ["/app/svod", "healthcheck"]
ENTRYPOINT ["/app/svod"]
