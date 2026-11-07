# PDF Requirements Audit — Public Static Demo

**Reviewed:** 2026-11-07 (Africa/Cairo)  
**Implementation:** `/home/user/ai-sales-agent-publish`  
**Supersedes:** the findings in `PUBLIC_URLS_PDF_AUDIT_2026-11-06.md`, which described the pre-completion public UI.  
**Evidence:** latest local `npm run verify` and `/ai-sales-agent` base-path build passed on 2026-11-07; the latest dashboard, inventory, and unit-detail changes still need pushing/deployment.

## Requirement-by-requirement status

| # | PDF requirement | Current implementation and evidence | Status |
|---|---|---|---|
| 1 | Sara is a sales manager from X (company name); start with the specified Arabic greeting | Sara is identified as the sales manager and new visitors receive the Arabic greeting verbatim. The `X (company name)` affiliation is deliberately not invented because the owner has not supplied the real company name. | **PARTIAL — company name pending** |
| 2 | Ask location, budget, then area, one question at a time | The qualification state machine asks only the first unanswered field in location → budget → area order, can retain volunteered answers, and clarifies invalid input. Unit and live-chat E2E cover the flow. | **PASS** |
| 3 | Present only the closest property to the visitor’s preferences | Search uses the deterministic sample catalogue and presents at most one exact or transparently labelled nearest match. Exact and relaxed/closest paths have unit and browser coverage. | **PASS** |
| 4 | Disclose location, price, and area one detail at a time | The property-disclosure state machine gates each stage behind the visitor’s reply. E2E verifies location/price/area progression. | **PASS** |
| 5 | Ask cash vs installments before sharing payment-plan terms | Payment choice is an explicit step. Installment plans are revealed only after choosing installments; the cash branch has no plan data or terms. Unit and E2E coverage. | **PASS** |
| 6 | After the details, handle confirmation or exploring another property | The follow-up state machine handles confirmation and an alternative-search path. Tests cover both; the UI offers these choices after the staged details. | **PASS** |
| 7 | Capture why a property is unsuitable | The visitor can select a reason (including price, location, area, payment, or other) and optional detail; the demo conversation records it in its in-memory interaction state and uses it while offering an alternative. This is not presented as real customer analytics and is not a durable lead-management system. | **PASS — demo-session scope** |
| 8 | Show dummy property photos | The selected sample listing can return bundled illustrative photos in chat and opens an in-map-surface detail view with gallery, specs, price, and payment-plan details. Pexels stock photos are bundled locally, source-linked, and clearly labelled illustrative; unit/map/chat demo flows are E2E-tested. | **PASS** |
| 9 | Remove the thinking banner from the GUI | Thinking/retrieval status log and its settings toggle were removed. No user-facing chain-of-thought panel is shown; the ordinary transient typing indicator remains. | **PASS** |
| 10 | Remove cycle count from the GUI | No retrieval-cycle control or count is exposed. The provider-side limit remains an internal fixed value. | **PASS** |
| 11 | Minimalistic yet impressive GUI | The conversations sidebar, history controls, and 3D visualization are gone. The interface has one chat, compact toolbar, detailed map, a full-page Analysis dashboard opened in a new tab, and an in-place unit-detail view. Responsive/mobile and accessibility smoke tests pass. “Impressive” is subjective and no separate owner screenshot sign-off is recorded. | **IMPLEMENTED — owner visual sign-off remains subjective** |
| 12 | Use a 2D Egypt map instead of a 3D globe/visualization | The right panel now uses a detailed, bundled OpenStreetMap road basemap with bilingual governorate outlines, selectable city/area/property markers, smooth zoom/pan, selection focus, and offline interaction. An unobtrusive OpenStreetMap contributor/ODbL credit stays inside the map. No external tile requests are used. | **PASS** |
| 13 | Dashboard with client/message counts by day, week, and month | The dedicated `/analysis/` page opens in a new tab and uses the full viewport while preserving the same dark glass visual language. Day/week/month filters drive synthetic client, conversation, and message metrics; the original chat tab remains open and unchanged. | **PASS** |
| 14 | Hot properties, hot locations, and useful graphs | The full-page dashboard includes message and lead-stage charts, ranked property/location activity, payment-preference and rejection-reason breakdowns, and a synthetic-data notice. Dashboard behavior is covered by unit and E2E tests. | **PASS** |

## PDF requirements still outstanding

1. **Company affiliation:** the PDF says Sara is a sales manager from “X (company name).” The real company name has not been supplied, and the project instruction is not to invent one. Sara’s role is implemented; the company-name part remains unfilled until the owner provides it.
2. **Subjective visual approval:** the requested minimalistic-yet-impressive GUI is implemented, but that subjective criterion still needs the owner’s visual sign-off.

All other concrete behavior listed in the one-page PDF is implemented and verified.

## Additional map acceptance (requested separately from the PDF)

Map selection is preserved as structured metadata on the user turn and included in the current model-bound message context. In the no-key demo, selecting or typing a city/area in chat updates map zoom/drill state, and a returned sample property focuses/highlights its building marker and opens unit details; tool-generated `VizDirective` updates work as well. Clicking a property marker replaces the map with a detail page in the same work surface, with Back to map retaining the context. The Analysis control opens a full-page dashboard in a new tab. E2E/unit checks cover these interactions.

## Static public-hosting safety (additional to the PDF checklist)

GitHub Pages is static and does not provide this app a secure backend or API-key vault. The public build is explicitly demo-only: API-key controls are absent, provider-key paths are blocked, and the interactive chat uses synthetic data. The UI does not claim browser-local encryption. If an older version left local API-key data in this browser, Settings discloses its presence and offers an explicit removal action. Analytics, inventory, photos, rejection events, and property offers are demonstrations, not real business records.

## Verification evidence

The latest grouped `npm run verify` completed successfully: typecheck passed; lint had 12 warnings and no errors; all 119 unit tests passed; secret scan clean; dependency audit found 0 vulnerabilities; production static build passed; all 12 Playwright E2E tests passed. Coverage includes the new-tab full-page analytics route, ten added listings, stock-photo rendering, unit-detail map replacement/back behavior, model-demo discovery of a new Alexandria listing, map/chat synchronization, static safety, Arabic greeting, staged disclosure, accessibility smoke, and mobile layout. A separate `NEXT_PUBLIC_BASE_PATH=/ai-sales-agent npm run build` also passed for the Pages URL. These latest changes are verified locally but not yet deployed.
