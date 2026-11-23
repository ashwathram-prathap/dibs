import { THEME_SCRIPT, CRITICAL_CSS } from './shared/critical';
import { writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import {
  HOME_TITLE,
  HOME_DESCRIPTION,
  escapeHtml,
  rulesHtml,
  homeStructuredData,
} from './shared/seo';
import { createHash } from 'node:crypto';
import { SECURITY_HEADERS } from './shared/security';
import { PUBLIC_ORIGIN } from './shared/config';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const out = mode === 'security-test' ? '.tmp/e2e-dist' : 'dist';
  const builtPolicy = () =>
    existsSync(out + '/_headers')
      ? readFileSync(out + '/_headers', 'utf8').match(/Content-Security-Policy: ([^\n]+)/)?.[1] ||
        SECURITY_HEADERS['Content-Security-Policy']
      : SECURITY_HEADERS['Content-Security-Policy'];
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
            .replace(
              /<script>\s*__THEME_SCRIPT__;?\s*<\/script>/,
              '<script>' + THEME_SCRIPT + '</script>',
            )
            .replace('__CRITICAL_HEAD__', '<style>' + CRITICAL_CSS + '</style>')
            .replace(
              '__STRUCTURED_DATA__',
              publicOrigin === PUBLIC_ORIGIN
                ? '<script type="application/ld+json">' +
                    JSON.stringify({
                      '@context': 'https://schema.org',
                      '@graph': homeStructuredData(publicOrigin),
                    }).replace(/</g, '\\u003c') +
                    '</script>'
                : '',
            )
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
          // Inline the stylesheet without changing its cascade order. Page JS stays lazy.
          const htmlPath = out + '/index.html';
          let html = readFileSync(htmlPath, 'utf8');
          let initialStyleHash = '';
          html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (tag, href) => {
            if (!/^\/assets\/index-[^/]+\.css$/.test(href)) return tag;
            const css = readFileSync(out + href, 'utf8');
            initialStyleHash = createHash('sha256').update(css).digest('base64');
            return '<style>' + css + '</style>';
          });
          if (!initialStyleHash) throw new Error('Initial stylesheet missing from build');
          writeFileSync(htmlPath, html);
          writeFileSync(out + '/version.json', JSON.stringify({ buildId }));
          const headers: Record<string, string> = {
            ...SECURITY_HEADERS,
            'Content-Security-Policy': SECURITY_HEADERS['Content-Security-Policy']
              .replaceAll('wss://dibs.here', publicOrigin.replace('https:', 'wss:'))
              .replace("style-src 'self'", "style-src 'self' 'sha256-" + initialStyleHash + "'"),
          };
          if (publicOrigin === PUBLIC_ORIGIN) delete headers['X-Robots-Tag'];
          writeFileSync(
            out + '/_headers',
            '/*\n' +
              Object.entries(headers)
                .map(([k, v]) => '  ' + k + ': ' + v)
                .join('\n') +
              '\n  Cache-Control: no-cache, no-transform\n/grain.*\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable\n/assets/*\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable\n/fonts/*\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable\n/audio/*\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable\n/catalog/*\n  ! Cache-Control\n  Cache-Control: public, max-age=86400\n',
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
      // The Pages middleware makes injected beacons inert; analytics.js gates real visits.
    ],
    // WebKit screenshots inject exactly "body {}" to synchronize animations.
    // The inert rule is hash-authorized only in the isolated test build.
    preview: {
      headers:
        mode === 'security-test'
          ? {
              ...SECURITY_HEADERS,
              'Content-Security-Policy': builtPolicy().replace(
                "style-src 'self'",
                "style-src 'self' 'sha256-" +
                  createHash('sha256').update('body {}').digest('base64') +
                  "'",
              ),
            }
          : { ...SECURITY_HEADERS, 'Content-Security-Policy': builtPolicy() },
    },
    server: { proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } } },
    build: {
      outDir: mode === 'security-test' ? '.tmp/e2e-dist' : 'dist',
      sourcemap: false,
      target: ['es2022', 'safari16', 'chrome110', 'firefox115'],
    },
  };
});
