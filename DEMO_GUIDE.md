# SARA Real Estate Agent — Public Demo

**Try the demo:** https://ahmed-sleem.github.io/ai-sales-agent/

## What this is

This is a static, no-key product demo—not a live real-estate service or a live AI deployment. The catalogue, property photos, customer activity, and analytics are synthetic examples. Nothing shown is a real listing, offer, client, or business metric.

The demo opens in Arabic for visitors without a saved language preference, using the specified Sara sales-manager greeting. Use the language button to switch between Arabic and English.

## Try it

- Use the single chat composer to answer the location, budget, and area questions one at a time.
- Sara searches the bundled sample catalogue and shows at most one closest match, clearly labelled as illustrative. Location, price, area, and payment preference are disclosed in stages. Cash selection does not reveal installment-plan terms.
- After reviewing a sample property, you can confirm, explore another option, give a reason it is unsuitable, or request synthetic example photos.
- The toolbar switches the right-side panel between the map and analytics. The map is replaced in that panel while Analysis is open; the chat/composer stays visible and the transcript remains intact.
- The detailed Egypt road map is bundled OpenStreetMap SVG data with an on-map contributor/ODbL credit. Bilingual governorate outlines, place labels, map zoom/pan, selection focus, and catalogue drill-down are local and work offline.
- Selecting a mapped place attaches it to the user’s chat message; live-agent tool directives can also focus and highlight map results. The illustrated property inventory is explicitly labeled and is not live market data.
- Use “Start another search” in the chat after a demo flow is complete to restart in place.

## Static-hosting and API-key safety

GitHub Pages does not provide this app with a secure application backend or API-key vault. Accordingly, this build disables provider API-key entry and live-agent mode; it does not accept or save keys. **Browser local storage is not encrypted.** If an older build left API-key data in this browser, Settings identifies it and offers an explicit clear action. Do not enter real credentials into a public demo.

## Development and verification

```bash
npm ci
npm run dev
npm run verify
```

`npm run verify` runs typecheck, lint, unit tests, secret scan, dependency audit, production static build, and Playwright browser/accessibility smoke tests.

## Data and map attribution

Analytics and inventory are deterministic fixtures for demonstration and testing. The road basemap is the bundled OpenStreetMap SVG at `public/maps/egypt-openstreetmap.svg`; the app credits OpenStreetMap contributors and links to the ODbL notice inside the map. Governorate paths come from the user-supplied map archive and are bundled in `data/egyptGovernorates.json`. Natural Earth geometry remains a local geographic reference for catalogue projection in `data/egypt.geo.json`. No tile server or external geocoder is used at runtime.
