# Project Completion Plan

**Last updated:** 2026-11-07  
**Basis:** one-page PDF requirements plus the current public deployment and the owner’s latest correction.  
**Working rule:** execute one task at a time; do not run tests after every task. Run grouped verification at the checkpoints below. Keep the existing single chat composer, transcript, and message bubbles—no duplicate chat UI.

## Product decisions

- Sara remains the sales-manager persona. Do not invent a company name for the PDF’s `X` placeholder.
- The app is a demo using synthetic catalogue, photo, and analytics data. Clearly label it; do not imply real listings or real client metrics.
- Remove the conversations sidebar, its toolbar toggle, and its search/switch/delete/list interactions completely, as explicitly allowed after the visibility fix did not resolve the owner’s issue. Keep one shared chat thread and provide an inline way to restart the demo without reintroducing a sidebar or composer.
- Replace the Three.js globe with a modest, responsive 2D Egypt SVG map. Use the already bundled Natural Earth geometry and catalogue-derived locations; no external map requests or elaborate new map authoring.
- Hide thinking traces and retrieval-cycle counts from the user-facing GUI. Keep any necessary model/tool limits internal.
- Keep project changes focused on the remaining PDF items and security/deployment correctness.

## Work plan

| ID | Task | Acceptance criteria | Status |
|---|---|---|---|
| 0 | Interactive demo chat and staged property response (previous work) | Sara’s greeting; one-at-a-time location → budget → area; 200–1500 ms variable pause and streamed replies; transparent closest-match path; staged location/price/area; plans only after installments; cash does not leak plan terms; confirmation/explore, rejection reason, and synthetic photos. | **Done** — core demo flow deployed in `619f47b`; the new-visitor default is now Arabic with the exact PDF greeting, and English remains user-selectable. Keep regression coverage. |
| 1 | Remove the problematic conversations menu completely | Remove `LeftPanel`, the chats/search toggle, left resize handle, mobile drawer/backdrop, and sidebar-only create/search/switch/delete controls. Keep one active thread and add a small in-chat restart action so the demo remains usable after completion. Do not add another composer/transcript. | **Done** — sidebar component, toggle, drawer, resize logic, and menu-only context APIs removed. A completed demo restarts in the same composer; desktop/mobile E2E verifies no history menu and only one composer. |
| 2 | Remove thinking-log banner and cycle-count controls | No thinking/status banner, cycle count, or associated Settings controls remain visible; any internal safety limit stays internal. | **Done** — removed Settings workflow/cycle tab, thinking-log toggle/state/storage, persisted-log rendering, and live status-card rendering. Provider path keeps only a fixed internal `maxCycles: 3`; E2E confirms no banner or cycle controls. |
| 3 | Replace 3D visualization with 2D Egypt map | Use bundled SVG projection/geometry; show catalogue city/area/property markers with accessible labels and a selected-location detail; preserve layout, Arabic/English, dark styling, and offline operation. Remove the 3D reset/planet UI and obsolete Three.js view/assets if no longer used. | **Done** — offline SVG map with city→district→community→sample-property navigation and CC0 attribution; removed 3D/list views, 3D Settings/context state, Three.js packages, and unused GLB models. E2E verifies drill-down and no map-tile requests. |
| 4 | Add the demo analytics dashboard | Reachable without a sidebar; daily/weekly/monthly client counts, conversation/message counts, hot properties, hot locations, and useful inline-SVG charts. Add a conspicuous synthetic-data notice; counts and charts reconcile to the selected period. Update stale fixture reference dates so the dashboard has current demo periods. | **Done** — new dashboard replaces the chat view in-place via a toolbar switch; the original chat stays mounted and returns intact, with no second composer. Day/week/month selectors, KPI counts, message bars, lead-stage chart, hot property/location rankings, bilingual copy, and synthetic notice are present. Fixture is dated 2026-11-07. Checkpoint B tests passed. |
| 5 | Make static demo/runtime claims safe and honest | GitHub Pages must not claim server-encrypted key storage or silently imply a secure live-agent backend where no backend exists. Clearly label/disable unavailable live features on static hosting; keep the no-key demo working. | **Done** — static-host detection locks the agent to no-key demo, blocks browser-local keys and provider calls, and replaces API-key controls with an explicit warning. Previously saved browser key data is not loaded and can be explicitly cleared; secure-backend mode remains separate. E2E verifies the no-key UI and legacy-key cleanup. |
| 6 | Update project documentation and remove dead UI/code | Preserve the explicitly requested URL-only root README; publish a demo guide and refresh the PDF audit against the completed app. Record map attribution/license; remove obsolete sidebar/3D/thinking-control references and unused dependencies/assets where safe. | **Done** — `README.md` remains the Pages URL only; `DEMO_GUIDE.md` explains the synthetic public demo, staged chat, dashboard, offline SVG map, and no-key/static-storage limits. Added a current PDF audit; it marks all measurable items passed and calls out subjective owner visual sign-off. Map attribution/license is visible in-app. Removed Three.js/GLB assets with Task 3 and pruned 97 unused CSS selector rules, along with obsolete sidebar comments/variables. |
| 7 | Final grouped verification and deploy | Run typecheck, lint, unit tests, accessibility/E2E, secret scan, dependency audit, production/static build, then push and verify Pages/CI. Report PDF items done/not done by chat/persona, model/demo behavior, and GUI. | **Local verification passed and committed; push/live verification blocked** — `git push origin main` could not authenticate (HTTPS requested a username with no terminal); the GitHub connector is unsupported in this workspace. The local `main` commit is ready to push when credentials are available. |

## Verification checkpoints (batched, not after each task)

1. **Checkpoint A — after Tasks 1–3:** typecheck + unit tests + E2E/accessibility for the single-thread restart flow, removed sidebar, settings removals, and 2D map; then review visuals before continuing.
2. **Checkpoint B — after Tasks 4–5:** dashboard aggregation/date/chart checks, static-host feature disclosure checks, and updated E2E flows.
3. **Final checkpoint — after Tasks 6–7:** full `npm run verify`, clean diff/secret check, commit/push, confirm GitHub Actions/Pages success, and inspect the live URL.

### Checkpoint results

- **A:** after the corrected map locator/overlap and restart expectation, `npm run test:e2e` passed 6/6; the earlier full verify passed typecheck, 116 unit tests, secret scan, 0-vulnerability audit, and static build (lint had 15 warnings).
- **B:** `npm run verify` passed with the dashboard and static-key safety flows: typecheck, 116 unit tests, secret scan clean, 0 vulnerabilities, production static build, and 8/8 E2E. Lint had 13 warnings and no errors.
- **Final local run (2026-11-07):** after default-Arabic greeting, URL-only README/docs, and dead-CSS cleanup, `npm run verify` passed; 116/116 unit tests and 9/9 E2E, static build, secret scan, and dependency audit passed. Lint has 12 warnings/no errors. A production export with the GitHub Pages base path (`NEXT_PUBLIC_BASE_PATH=/ai-sales-agent`) also builds successfully. Push/live deployment verification remains blocked until authenticated GitHub access is available; the implementation is committed locally.

## Change log

- 2026-11-07: Created plan after the owner reported the left conversations menu still hides content unless hovered. Decision: remove the sidebar and its toggle/functionality rather than continue polishing it. Previous response-quality work is retained as Task 0.
