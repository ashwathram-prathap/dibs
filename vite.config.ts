import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const token =
    process.env.VITE_CF_ANALYTICS_TOKEN ||
    loadEnv(mode, process.cwd(), 'VITE_').VITE_CF_ANALYTICS_TOKEN;
  return {
    plugins: [
      react(),
      {
        name: 'cookieless-analytics',
        transformIndexHtml: () =>
          /^[a-f0-9]{32}$/.test(token || '')
            ? [
                {
                  tag: 'script',
                  attrs: {
                    defer: true,
                    src: 'https://static.cloudflareinsights.com/beacon.min.js',
                    'data-cf-beacon': JSON.stringify({ token }),
                  },
                  injectTo: 'body' as const,
                },
              ]
            : [],
      },
    ],
    server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
    build: { sourcemap: false, target: ['es2022', 'safari16', 'chrome110', 'firefox115'] },
  };
});
