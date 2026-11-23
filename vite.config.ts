import { THEME_SCRIPT, CRITICAL_CSS } from './shared/critical';
import { writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { HOME_TITLE, HOME_DESCRIPTION, escapeHtml, rulesHtml } from './shared/seo';
import { createHash } from 'node:crypto';
import { SECURITY_HEADERS } from './shared/security';
import { PUBLIC_ORIGIN } from './shared/config';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const token =
    process.env.VITE_CF_ANALYTICS_TOKEN ||
    loadEnv(mode, process.cwd(), 'VITE_').VITE_CF_ANALYTICS_TOKEN;
  const buildId = process.env.DIBS_BUILD_ID || new Date().toISOString();
  const publicOrigin = process.env.DIBS_PUBLIC_ORIGIN || PUBLIC_ORIGIN;
  return {
    define: {
      DIBS_PUBLIC_ORIGIN: JSON.stringify(publicOrigin),
      __BUILD_ID__: JSON.stringify(buildId),
    },
    ...(mode === 'security-test'
      ? {
          define: {
            DIBS_PUBLIC_ORIGIN: JSON.stringify(publicOrigin),
            __BUILD_ID__: JSON.stringify(buildId),
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
            .replace('__THEME_SCRIPT__', THEME_SCRIPT)
            .replace('__CRITICAL_HEAD__', '<style>' + CRITICAL_CSS + '</style>')
            .replace('__RULES_HTML__', rulesHtml)
            .replace(
              'name="robots" content="noindex,nofollow"',
              `name="robots" content="${publicOrigin === PUBLIC_ORIGIN ? 'index,follow' : 'noindex,nofollow'}"`,
            )
            .replaceAll('__PUBLIC_ORIGIN__', publicOrigin)
            .replaceAll('__HOME_TITLE__', escapeHtml(HOME_TITLE))
            .replaceAll('__HOME_DESCRIPTION__', escapeHtml(HOME_DESCRIPTION))
            .replaceAll('__HOME_TITLE__', escapeHtml(HOME_TITLE))
            .replaceAll('__HOME_DESCRIPTION__', escapeHtml(HOME_DESCRIPTION)),
      },
      react(),
      {
        name: 'static-release',
        closeBundle() {
          const out = mode === 'security-test' ? '.tmp/e2e-dist' : 'dist';
          writeFileSync(out + '/version.json', JSON.stringify({ buildId }));
          const headers: Record<string, string> = {
            ...SECURITY_HEADERS,
            'Content-Security-Policy': SECURITY_HEADERS['Content-Security-Policy'].replaceAll(
              'wss://dibs.here',
              publicOrigin.replace('https:', 'wss:'),
            ),
          };
          if (publicOrigin === PUBLIC_ORIGIN) delete headers['X-Robots-Tag'];
          writeFileSync(
            out + '/_headers',
            '/*\n' +
              Object.entries(headers)
                .map(([k, v]) => '  ' + k + ': ' + v)
                .join('\n') +
              '\n  Cache-Control: no-cache\n/assets/*\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable\n/fonts/*\n  ! Cache-Control\n  Cache-Control: public, max-age=2592000\n/audio/*\n  ! Cache-Control\n  Cache-Control: public, max-age=2592000\n/catalog/*\n  ! Cache-Control\n  Cache-Control: public, max-age=86400\n',
          );
          if (publicOrigin === PUBLIC_ORIGIN)
            writeFileSync(
              out + '/_redirects',
              'https://dibs-7hz.pages.dev/* https://dibs.here/:splat 301\nhttps://www.dibs.here/* https://dibs.here/:splat 301\n',
            );
          // Public catalog manifests never publish the reserved-answer list.
          if (existsSync(out + '/catalog'))
            for (const slug of readdirSync(out + '/catalog')) {
              const path = out + '/catalog/' + slug + '/manifest.json';
              if (!existsSync(path)) continue;
              const { house, ...manifest } = JSON.parse(readFileSync(path, 'utf8'));
              writeFileSync(path, JSON.stringify(manifest));
            }
        },
      },
      {
        name: 'cookieless-analytics',
        transformIndexHtml: () =>
          publicOrigin === PUBLIC_ORIGIN && /^[a-f0-9]{32}$/.test(token || '')
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
