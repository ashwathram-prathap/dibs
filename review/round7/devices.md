# Round 7 browser verification

555/555 distinct checks passed. Full matrix: 434 Chromium/WebKit + 72 Firefox. Targeted R7 checks: 42 local + 7 Firefox. The 28 local/7 Firefox skipped entries repeat timezone cases outside the one dedicated timezone project; all seven timezone/fallback cases execute in Chromium.

[Full Firefox run](https://github.com/ashwathram-prathap/dibs/actions/runs/44976589223). [Final R7 Firefox run](https://github.com/ashwathram-prathap/dibs/actions/runs/44976984736). Mac Firefox remains unable to find its profile even with project-local temporary storage; Linux supplies coverage.

| Profile | Pass | Fail | Host |
| --- | ---: | ---: | --- |
| r6-390-light | 1 | 0 | macOS |
| iPhone-SE-light | 12 | 0 | macOS |
| iPhone-15-Pro-light | 12 | 0 | macOS |
| iPhone-15-Pro-Max-light | 12 | 0 | macOS |
| Pixel-7-light | 12 | 0 | macOS |
| Galaxy-S9+-light | 12 | 0 | macOS |
| iPad-Mini-light | 12 | 0 | macOS |
| iPad-Pro-11-landscape-light | 12 | 0 | macOS |
| chromium-1280-light | 12 | 0 | macOS |
| chromium-1440-light | 12 | 0 | macOS |
| chromium-2560-light | 12 | 0 | macOS |
| webkit-1280-light | 12 | 0 | macOS |
| webkit-1440-light | 12 | 0 | macOS |
| webkit-2560-light | 12 | 0 | macOS |
| 320-small-light | 12 | 0 | macOS |
| landscape-phone-light | 12 | 0 | macOS |
| r6-390-dark | 1 | 0 | macOS |
| iPhone-SE-dark | 12 | 0 | macOS |
| iPhone-15-Pro-dark | 12 | 0 | macOS |
| iPhone-15-Pro-Max-dark | 12 | 0 | macOS |
| Pixel-7-dark | 12 | 0 | macOS |
| Galaxy-S9+-dark | 12 | 0 | macOS |
| iPad-Mini-dark | 12 | 0 | macOS |
| iPad-Pro-11-landscape-dark | 12 | 0 | macOS |
| chromium-1280-dark | 12 | 0 | macOS |
| chromium-1440-dark | 12 | 0 | macOS |
| chromium-2560-dark | 12 | 0 | macOS |
| webkit-1280-dark | 12 | 0 | macOS |
| webkit-1440-dark | 12 | 0 | macOS |
| webkit-2560-dark | 12 | 0 | macOS |
| 320-small-dark | 12 | 0 | macOS |
| landscape-phone-dark | 12 | 0 | macOS |
| Instagram-iPhone-15-Pro | 12 | 0 | macOS |
| Instagram-Pixel-7 | 12 | 0 | macOS |
| TikTok-iPhone-15-Pro | 12 | 0 | macOS |
| TikTok-Pixel-7 | 12 | 0 | macOS |
| X-iPhone-15-Pro | 12 | 0 | macOS |
| X-Pixel-7 | 12 | 0 | macOS |
| firefox-1280-light | 12 | 0 | Linux CI |
| firefox-1440-light | 12 | 0 | Linux CI |
| firefox-2560-light | 12 | 0 | Linux CI |
| firefox-1280-dark | 12 | 0 | Linux CI |
| firefox-1440-dark | 12 | 0 | Linux CI |
| firefox-2560-dark | 12 | 0 | Linux CI |
| r7-chromium-390-light | 14 | 0 | macOS |
| r7-chromium-390-dark | 7 | 0 | macOS |
| r7-chromium-1440-light | 7 | 0 | macOS |
| r7-chromium-1440-dark | 7 | 0 | macOS |
| r7-webkit-390-light | 7 | 0 | macOS |
| r7-firefox-390-light | 7 | 0 | Linux CI |

These are browser-engine, viewport and user-agent checks. Physical iOS Safari 16, Samsung Internet, branded Edge, native social-app webviews, OS keyboards and native sharing destinations still require owner device smoke checks. Live verification uses read-only requests; no production/practice claims were filed and no player resets were used.
