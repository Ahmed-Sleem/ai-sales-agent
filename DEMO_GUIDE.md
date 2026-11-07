# SARA Real Estate Agent — Public Demo

**Try the demo:** https://ahmed-sleem.github.io/ai-sales-agent/

## What this is

This is a static, no-key product demo—not a live real-estate service or a live AI deployment. The catalogue, property photos, customer activity, and analytics are synthetic examples. Nothing shown is a real listing, offer, client, or business metric.

The demo opens in Arabic for visitors without a saved language preference, using the specified Sara sales-manager greeting. Use the language button to switch between Arabic and English.

## Try it

- Use the single chat composer to answer the location, budget, and area questions one at a time.
- Sara searches the bundled sample catalogue and shows at most one closest match, clearly labelled as illustrative. Location, price, area, and payment preference are disclosed in stages. Cash selection does not reveal installment-plan terms.
- The catalogue includes ten additional searchable units: three in Alexandria, three in Cairo, and four across Giza/West Cairo and the North Coast. Their synthetic details are available to the no-key model demo and map.
- Click a property marker once to replace the map work surface with a full unit-detail view: photo gallery, price, area, bedrooms, finishing, delivery, and illustrative payment terms. Use Back to map to return. The demo model can focus/open the same detail view when it finds a unit.
- After reviewing a sample property, you can confirm, explore another option, give a reason it is unsuitable, or request demo photos.
- The Analysis toolbar opens a full-viewport professional dashboard in a new browser tab, with the same dark visual system, period filters, KPI cards, charts, hot properties/locations, payment preferences, and rejection reasons. The original chat tab stays open and unchanged.
- The detailed Egypt road map is bundled OpenStreetMap SVG data with an on-map contributor/ODbL credit. Bilingual governorate outlines, place labels, smooth animated zoom/pan, selection focus, and catalogue drill-down are local and work offline; reduced-motion preferences are respected.
- Selecting a mapped place attaches it to the user’s chat message. In the no-key demo, choosing or typing a city/area in chat also zooms and drills the map; when the demo returns a sample property, its building marker is focused and highlighted. Live-agent tool directives can do the same. The illustrated property inventory is explicitly labeled and is not live market data.
- The full Analysis page scrolls naturally when needed; its dashboard cards reflow for smaller screens without changing the original workspace tab.
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

Analytics and inventory are deterministic fixtures for demonstration and testing. The road basemap is the bundled OpenStreetMap SVG at `public/maps/egypt-openstreetmap.svg`; the app credits OpenStreetMap contributors and links to the ODbL notice inside the map. Governorate paths come from the user-supplied map archive and are bundled in `data/egyptGovernorates.json`. Natural Earth geometry remains a local geographic reference for catalogue projection in `data/egypt.geo.json`. No tile server or external geocoder is used at runtime. Selected-unit stock photos from Pexels are bundled locally for offline display; each stock image links to its source from the unit detail view, and is labelled illustrative rather than a photo of the actual sample unit.
