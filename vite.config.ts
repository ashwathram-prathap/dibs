import { HOME_TITLE, HOME_DESCRIPTION, escapeHtml } from './shared/seo';
import { createHash } from 'node:crypto';
import { SECURITY_HEADERS } from './shared/security';
import { PUBLIC_ORIGIN } from './shared/config';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const token =
    process.env.VITE_CF_ANALYTICS_TOKEN ||
    loadEnv(mode, process.cwd(), 'VITE_').VITE_CF_ANALYTICS_TOKEN;
  const publicOrigin = process.env.DIBS_PUBLIC_ORIGIN || PUBLIC_ORIGIN;
  return {
    define: { DIBS_PUBLIC_ORIGIN: JSON.stringify(publicOrigin) },
    ...(mode === 'security-test'
      ? {
          define: {
            DIBS_PUBLIC_ORIGIN: JSON.stringify(publicOrigin),
            'import.meta.env.DEV': 'true',
            'import.meta.env.VITE_DEMO': JSON.stringify('true'),
          },
        }
      : {}),
    plugins: [
      {
        name: 'public-origin',
        transformIndexHtml: (html: string) =>
          html
            .replaceAll('__PUBLIC_ORIGIN__', publicOrigin)
            .replaceAll('__HOME_TITLE__', escapeHtml(HOME_TITLE))
            .replaceAll('__HOME_DESCRIPTION__', escapeHtml(HOME_DESCRIPTION))
            .replaceAll('__HOME_TITLE__', escapeHtml(HOME_TITLE))
            .replaceAll('__HOME_DESCRIPTION__', escapeHtml(HOME_DESCRIPTION)),
      },
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
    // WebKit screenshots inject exactly "body {}" to synchronize animations.
    // The inert rule is hash-authorized only in the isolated test build.
    preview: {
      headers:
        mode === 'security-test'
          ? {
              ...SECURITY_HEADERS,
              'Content-Security-Policy': SECURITY_HEADERS['Content-Security-Policy'].replace(
                "style-src 'self'",
                "style-src 'self' 'sha256-" +
                  createHash('sha256').update('body {}').digest('base64') +
                  "'",
              ),
            }
          : SECURITY_HEADERS,
    },
    server: { proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } } },
    build: {
      outDir: mode === 'security-test' ? '.tmp/e2e-dist' : 'dist',
      sourcemap: false,
      target: ['es2022', 'safari16', 'chrome110', 'firefox115'],
    },
  };
});
