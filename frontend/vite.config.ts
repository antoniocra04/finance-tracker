import { defineConfig } from 'vite';

export default defineConfig({
  build: { outDir: '../internal/web/spa/static/generated', emptyOutDir: true },
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        configure(proxy) {
          proxy.on('proxyReq', (request, incoming) => {
            if (incoming.headers.origin === `http://${incoming.headers.host}`) {
              request.setHeader('Origin', 'http://127.0.0.1:3000');
              request.setHeader('Host', '127.0.0.1:3000');
            }
          });
        }
      }
    }
  }
});
