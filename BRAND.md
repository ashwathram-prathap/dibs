# Dibs: paper and carbon

Dibs is a daily word game with the character of a printed register. Use plain words; keep the office flavour in headings. A player should understand what to do without knowing the metaphor.

## Three type families

| Family | Role | Weights and scale |
| --- | --- | --- |
| Archivo | Wordmark, category, countdown, stamps, big headings | 900 for display and stamps; 800–900 for headings. Wide axis 125 for the category; clock uses the actual R7 reference axis (100) and weight 900. Headings 28/32/44/64px; category up to 192px; clock up to 164px, fitted to available width. |
| Instrument Sans | Body, instructions, counters, errors, buttons, inputs and menus | 400 body; 500–650 emphasis; 700 primary actions. 18px body and controls, 20px primary action, 16px secondary text, 14px helpers. Body line-height 1.5–1.6. Never substitute a mono or serif face. |
| IBM Plex Mono | Form numbers, certificate/ledger field labels, certificate dates and times, ledger entry/edition numbers, backup codes | 400, at least 14px desktop / 13px phone; inputs remain at least 16px. Short form labels alone may be uppercase, 1–3 words, tracking at most 0.06em. Use a few per screen. Never use for instructions, menus, buttons or counters. |

Browser font subsets share these names. Archivo's three missing catalog glyphs use licensed Archivo-derived outlines under the same CSS family; this is glyph coverage, not a fourth type role. Canvas exports use the same three families. Server previews render their outlines. Countdown digits are tabular, separated, solid and unfiltered; ink texture belongs to stamps, never the clock.

## Colour

| Token | Paper / light | Carbon / dark |
| --- | --- | --- |
| Page | `#F1ECE2` | `#16150F` |
| Panel | `#E4DDCF` | `#1F1E18` |
| Ink | `#1A1A17` | `#F1ECE2` |
| Muted ink | `#5C5A53` | `#E4DDCF` |
| Vermilion stamp / primary fill | `#E1462B` | `#E1462B` |
| Accessible red text | `#B93420` | `#FF836B` |
| Gold text | `#795700` | `#E7C86B` |
| Rule | `#1A1A17` | `#E4DDCF` |

Use the same paper grain at 4% opacity in both themes. Carbon stays warm, never pure black. Links use ink with a vermilion underline. Primary vermilion buttons use large bold light text; small red text uses the accessible red token. Check AA contrast in both themes.

## Marks, lines and voice

Use one 1px frame/rule, including certificates and cards (2px at 1080px export scale). No inset second frame. Controls alone may have a 3px radius; paper and stamps stay square. Stamps use heavy Archivo, one frame, a small rotation, vermilion for an ordinary result and gold only for a golden ticket. The existing restrained ink filter softens stamp edges; reduced-motion/low-power fallbacks stay legible. Gold founder text is the existing identity exception.

Icons are simple custom SVG strokes, consistent weight, with text labels for actions. Keep sharing prominent after a result: primary **Share**, secondary outlined **Copy result**. During play the primary action is **CALL DIBS**.

Don't use emoji in the UI, crosshair marks, dashed rules, double frames, tiny all-caps labels outside the form-label rule, default-blue links, gradients, soft shadows, pill controls, serif faces or decorative fonts. Use sentence case for copy. Avoid jargon in instructions and errors; say what happened and what to do next.
