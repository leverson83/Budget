import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8585',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => {
          console.log('🔀 Proxying:', path, '→', `http://localhost:8585${path}`);
          return path;
        },
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('❌ Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('📤 Sending Request to Target:', req.method, req.url, '→ http://localhost:8585');
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('📥 Received Response from Target:', proxyRes.statusCode, req.url);
          });
        }
      }
    }
  },
}); 