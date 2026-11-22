# Round 4 browser verification

Engine/device and user-agent emulation; native share APIs are stubbed to exercise file, text, cancellation and blocked-sheet behavior. Intent destinations are intercepted locally; tests do not post to social platforms.

| Configuration | Passed | Failed | Host |
| --- | ---: | ---: | --- |
| iPhone-SE-light | 11 | 0 | macOS |
| iPhone-15-Pro-light | 11 | 0 | macOS |
| iPhone-15-Pro-Max-light | 11 | 0 | macOS |
| Pixel-7-light | 11 | 0 | macOS |
| Galaxy-S9+-light | 11 | 0 | macOS |
| iPad-Mini-light | 11 | 0 | macOS |
| iPad-Pro-11-landscape-light | 11 | 0 | macOS |
| chromium-1280-light | 11 | 0 | macOS |
| chromium-1440-light | 11 | 0 | macOS |
| chromium-2560-light | 11 | 0 | macOS |
| webkit-1280-light | 11 | 0 | macOS |
| webkit-1440-light | 11 | 0 | macOS |
| webkit-2560-light | 11 | 0 | macOS |
| 320-small-light | 11 | 0 | macOS |
| landscape-phone-light | 11 | 0 | macOS |
| iPhone-SE-dark | 11 | 0 | macOS |
| iPhone-15-Pro-dark | 11 | 0 | macOS |
| iPhone-15-Pro-Max-dark | 11 | 0 | macOS |
| Pixel-7-dark | 11 | 0 | macOS |
| Galaxy-S9+-dark | 11 | 0 | macOS |
| iPad-Mini-dark | 11 | 0 | macOS |
| iPad-Pro-11-landscape-dark | 11 | 0 | macOS |
| chromium-1280-dark | 11 | 0 | macOS |
| chromium-1440-dark | 11 | 0 | macOS |
| chromium-2560-dark | 11 | 0 | macOS |
| webkit-1280-dark | 11 | 0 | macOS |
| webkit-1440-dark | 11 | 0 | macOS |
| webkit-2560-dark | 11 | 0 | macOS |
| 320-small-dark | 11 | 0 | macOS |
| landscape-phone-dark | 11 | 0 | macOS |
| Instagram-iPhone-15-Pro | 11 | 0 | macOS |
| Instagram-Pixel-7 | 11 | 0 | macOS |
| TikTok-iPhone-15-Pro | 11 | 0 | macOS |
| TikTok-Pixel-7 | 11 | 0 | macOS |
| X-iPhone-15-Pro | 11 | 0 | macOS |
| X-Pixel-7 | 11 | 0 | macOS |
| firefox-1280-light | 11 | 0 | Ubuntu CI |
| firefox-1440-light | 11 | 0 | Ubuntu CI |
| firefox-2560-light | 11 | 0 | Ubuntu CI |
| firefox-1280-dark | 11 | 0 | Ubuntu CI |
| firefox-1440-dark | 11 | 0 | Ubuntu CI |
| firefox-2560-dark | 11 | 0 | Ubuntu CI |

All 462 distinct checks passed after a targeted rerun. The first local matrix had 395 passes and one landscape failure when an index.html edit triggered Vite reload and reset its fixture to zero dibs. Three isolated repeats passed after edits stopped; raw original and recheck JSON are retained. Firefox cannot launch on this Mac (default and project-local profiles both fail before app load); the existing Ubuntu workflow supplies Firefox coverage. Physical Safari 16, Samsung Internet, branded Edge, real Instagram/TikTok/X native webviews and OS share targets still require a phone check; user-agent emulation does not prove OS integration.
