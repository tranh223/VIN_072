import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { ServerResponse } from 'http';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000';
  const ragTarget = env.VITE_RAG_PROXY_TARGET || 'http://127.0.0.1:8001';

  const makeErrorHandler = (target: string) => (proxy: import('http-proxy').Server) => {
    proxy.on('error', (_err, _req, res) => {
      const r = res as ServerResponse;
      if (r.writableEnded || r.headersSent) return;
      r.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      r.end(
        JSON.stringify({
          detail: `Không kết nối được backend (${target}). Hãy chạy API rồi tải lại trang.`,
        }),
      );
    });
  };

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '.ngrok-free.dev',
        '.trycloudflare.com', // Cloudflare Quick Tunnel (cloudflared --url)
        '.nip.io',
        '.sslip.io',
      ],
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          configure: makeErrorHandler(apiTarget),
        },
        '/rag': {
          target: ragTarget,
          changeOrigin: true,
          // SSE streaming: tắt buffer để token LLM truyền ngay lập tức
          selfHandleResponse: false,
          configure: makeErrorHandler(ragTarget),
        },
        '/storage': {
          target: apiTarget,
          changeOrigin: true,
          configure: makeErrorHandler(apiTarget),
        },
      },
    },
  };
});
