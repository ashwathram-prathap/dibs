# R19E visual review

The changed FAQ was inspected at 390×844 and 1440×900 in light and dark mode. The additional sentence wraps cleanly, uses the existing readable typography, and introduces no horizontal overflow or contrast failures. The familiar, middle, rarest and unmeasured payoff states retain the R19 bell and R19C wording; the marker agrees with the saved percentile.

The eight SPEC anti-AI checks pass for this change: existing paper/carbon treatment, square rules and ink buttons; no new gradients, cards, decorative icon packs, generic buttons, fonts, placeholders or stock art. The Office notice/serial, stamps and ruled layout remain deliberate details.

168 Chromium/WebKit checks across 42 device/theme profiles passed, including the full claim/taken/finish/certificate/share-fallback flow, scored payoff and FAQ accessibility. Firefox CI passed 24 corresponding checks across six desktop/theme profiles. These are emulations, not physical-device certification. Images remain in `review/round19e/ui/`, `review/devices/`, and the Firefox CI artifact.

The weakest existing views remain the long mobile Office page, the dense completed-day page, and certificates at extreme text zoom. No new layout defect was found in the changed score copy.

A final 48-case Chromium/WebKit pass at 390 and 1440 in both themes also passed, covering the retained R19C screen assertions and 248 captures. Those and the changed scoring/FAQ captures are in `review/final/round19e/`.

Final production Chromium FAQ captures at 390/1440 in both themes also show the new range cleanly. The eight production interaction cases passed with the real CSP and zero console errors. WebKit production smoke deliberately avoids Playwright screenshot injection; its visual evidence is the isolated-server capture set.
