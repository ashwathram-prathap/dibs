# Browser and device verification

Playwright engine/device emulation. These are not tests on physical phones or inside native social apps.

| Project | Result |
|---|---|
| iPhone-SE-light | PASS |
| iPhone-15-Pro-light | PASS |
| iPhone-15-Pro-Max-light | PASS |
| Pixel-7-light | PASS |
| Galaxy-S9+-light | PASS |
| iPad-Mini-light | PASS |
| iPad-Pro-11-landscape-light | PASS |
| chromium-1280-light | PASS |
| chromium-1440-light | PASS |
| chromium-2560-light | PASS |
| webkit-1280-light | PASS |
| webkit-1440-light | PASS |
| webkit-2560-light | PASS |
| firefox-1280-light | BLOCKED: Firefox failed to launch |
| firefox-1440-light | BLOCKED: Firefox failed to launch |
| firefox-2560-light | BLOCKED: Firefox failed to launch |
| 320-small-light | PASS |
| landscape-phone-light | PASS |
| iPhone-SE-dark | PASS |
| iPhone-15-Pro-dark | PASS |
| iPhone-15-Pro-Max-dark | PASS |
| Pixel-7-dark | PASS |
| Galaxy-S9+-dark | PASS |
| iPad-Mini-dark | PASS |
| iPad-Pro-11-landscape-dark | PASS |
| chromium-1280-dark | PASS |
| chromium-1440-dark | PASS |
| chromium-2560-dark | PASS |
| webkit-1280-dark | PASS |
| webkit-1440-dark | PASS |
| webkit-2560-dark | PASS |
| firefox-1280-dark | BLOCKED: Firefox failed to launch |
| firefox-1440-dark | BLOCKED: Firefox failed to launch |
| firefox-2560-dark | BLOCKED: Firefox failed to launch |
| 320-small-dark | PASS |
| landscape-phone-dark | PASS |

Firefox was attempted with the bundled release, a project-local profile, headed mode, an older release, a manually extracted older release, and reduced sandbox settings. macOS reports inaccessible profile / sandbox extension failure / software framebuffer failure before the app loads. No system permissions or settings were changed.

Physical Safari 16+, Android Chrome, Samsung Internet, Edge branding, native share sheets, on-screen keyboards, Instagram/TikTok/X/Discord in-app browsers, and iMessage preview caching still need physical-device checks. Browser tests verify fallback downloads, PNG sizes, responsive layout, keyboard selection, and axe AA checks.
