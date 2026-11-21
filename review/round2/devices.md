# Round 2 browser verification

Engine/device emulation, not physical phones or native webviews.

| Configuration | Passed | Failed |
| --- | ---: | ---: |
| iPhone-SE-light | 4 | 0 |
| iPhone-15-Pro-light | 4 | 0 |
| iPhone-15-Pro-Max-light | 4 | 0 |
| Pixel-7-light | 4 | 0 |
| Galaxy-S9+-light | 4 | 0 |
| iPad-Mini-light | 4 | 0 |
| iPad-Pro-11-landscape-light | 4 | 0 |
| chromium-1280-light | 4 | 0 |
| chromium-1440-light | 4 | 0 |
| chromium-2560-light | 4 | 0 |
| webkit-1280-light | 4 | 0 |
| webkit-1440-light | 4 | 0 |
| webkit-2560-light | 4 | 0 |
| 320-small-light | 4 | 0 |
| landscape-phone-light | 4 | 0 |
| iPhone-SE-dark | 4 | 0 |
| iPhone-15-Pro-dark | 4 | 0 |
| iPhone-15-Pro-Max-dark | 4 | 0 |
| Pixel-7-dark | 4 | 0 |
| Galaxy-S9+-dark | 4 | 0 |
| iPad-Mini-dark | 4 | 0 |
| iPad-Pro-11-landscape-dark | 4 | 0 |
| chromium-1280-dark | 4 | 0 |
| chromium-1440-dark | 4 | 0 |
| chromium-2560-dark | 4 | 0 |
| webkit-1280-dark | 4 | 0 |
| webkit-1440-dark | 4 | 0 |
| webkit-2560-dark | 4 | 0 |
| 320-small-dark | 4 | 0 |
| landscape-phone-dark | 4 | 0 |

Firefox desktop (1280/1440/2560, both themes): BLOCKED before app load. Retried default launch, project-local temporary profiles, and a clean Firefox install. All report “Could not find profile folder.” No OS settings were changed. Rerun `npm run test:e2e` on a host where Firefox launches. Physical Safari 16, Samsung Internet, branded Edge, social in-app browsers, native sharing and on-screen keyboards remain owner device checks.
