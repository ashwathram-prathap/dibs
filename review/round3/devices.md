# Round 3 browser checks

Chromium/WebKit on this Mac; Firefox on Ubuntu CI. Physical phones, Safari 16, Samsung Internet, branded Edge and embedded social browsers remain device checks, not claimed emulator coverage.

| Profile | Passed | App failures | Host |
| --- | ---: | ---: | --- |
| iPhone-SE-light | 5 | 0 | macOS |
| iPhone-15-Pro-light | 5 | 0 | macOS |
| iPhone-15-Pro-Max-light | 5 | 0 | macOS |
| Pixel-7-light | 5 | 0 | macOS |
| Galaxy-S9+-light | 5 | 0 | macOS |
| iPad-Mini-light | 5 | 0 | macOS |
| iPad-Pro-11-landscape-light | 5 | 0 | macOS |
| chromium-1280-light | 5 | 0 | macOS |
| chromium-1440-light | 5 | 0 | macOS |
| chromium-2560-light | 5 | 0 | macOS |
| webkit-1280-light | 5 | 0 | macOS |
| webkit-1440-light | 5 | 0 | macOS |
| webkit-2560-light | 5 | 0 | macOS |
| firefox-1280-light | 5 | 0 | Ubuntu CI |
| firefox-1440-light | 5 | 0 | Ubuntu CI |
| firefox-2560-light | 5 | 0 | Ubuntu CI |
| 320-small-light | 5 | 0 | macOS |
| landscape-phone-light | 5 | 0 | macOS |
| iPhone-SE-dark | 5 | 0 | macOS |
| iPhone-15-Pro-dark | 5 | 0 | macOS |
| iPhone-15-Pro-Max-dark | 5 | 0 | macOS |
| Pixel-7-dark | 5 | 0 | macOS |
| Galaxy-S9+-dark | 5 | 0 | macOS |
| iPad-Mini-dark | 5 | 0 | macOS |
| iPad-Pro-11-landscape-dark | 5 | 0 | macOS |
| chromium-1280-dark | 5 | 0 | macOS |
| chromium-1440-dark | 5 | 0 | macOS |
| chromium-2560-dark | 5 | 0 | macOS |
| webkit-1280-dark | 5 | 0 | macOS |
| webkit-1440-dark | 5 | 0 | macOS |
| webkit-2560-dark | 5 | 0 | macOS |
| firefox-1280-dark | 5 | 0 | Ubuntu CI |
| firefox-1440-dark | 5 | 0 | Ubuntu CI |
| firefox-2560-dark | 5 | 0 | Ubuntu CI |
| 320-small-dark | 5 | 0 | macOS |
| landscape-phone-dark | 5 | 0 | macOS |

180 checks passed across the three engines. Firefox on this Mac cannot create/find its profile: default launch, project-local temp directory, and explicit persistent/headful profile all failed before app load. The Ubuntu run passed all 30 Firefox checks. The real local Worker/D1 integration also passed 3 dibs plus 1 strike, exact event order, both reload states (3/1 and 0/5), and closed-file 403.
