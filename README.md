# Dibs

[Dibs](https://dibs.here) is a daily game about claiming something before anyone else. One category opens each night. Name an answer nobody has claimed, and it is yours, with your name on the record.

You get three claims and five strikes. Taken or reserved answers cost a strike; unknown answers and repeat guesses do not cost another strike. Rare answers earn more points, and hidden golden tickets add a bonus. Your results become a shareable certificate.

Dibs uses React and TypeScript on Cloudflare Pages, a Worker API, a Durable Object journal for ordered game events, and D1 for persistent records. It runs on Cloudflare's free tier. Live updates use WebSockets with HTTP fallback. Accepted results are acknowledged after the day object's journal is durable; D1 is a delayed mirror. A D1 export alone cannot recover acknowledged events that have not yet reached that mirror.

Built by Ashwathram Prathap with Codex and Claude in about 72 hours, followed by ongoing refinements.

**Not open source: all rights reserved, see [LICENSE](LICENSE).**

Credits: the data draws on Wikipedia and Wikidata contributors, WordNet, GeoNames, GBIF, USDA PLANTS, the Mammal Diversity Database, IOC, Open Food Facts, OurAirports, NASA/JPL and other credited sources. Third-party data, fonts and libraries retain their own licences. See the [sources page](https://dibs.here/about#sources) and [full data attribution](public/data/licenses.txt).
