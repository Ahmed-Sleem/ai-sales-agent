# Project Completion Plan

**Last updated:** 2026-11-07  
**Basis:** one-page PDF requirements plus the current public deployment and the owner’s latest correction.  
**Working rule:** execute one task at a time; do not run tests after every task. Run grouped verification at the checkpoints below. Keep the existing single chat composer, transcript, and message bubbles—no duplicate chat UI.

## Product decisions

- Sara remains the sales-manager persona. Do not invent a company name for the PDF’s `X` placeholder.
- The app is a demo using synthetic catalogue, photo, and analytics data. Clearly label it; do not imply real listings or real client metrics.
- Remove the conversations sidebar, its toolbar toggle, and its search/switch/delete/list interactions completely, as explicitly allowed after the visibility fix did not resolve the owner’s issue. Keep one shared chat thread and provide an inline way to restart the demo without reintroducing a sidebar or composer.
- Replace the Three.js globe with a responsive offline 2D Egypt map using the selected detailed OpenStreetMap SVG basemap and the separately bundled bilingual governorate paths. Keep visible, unobtrusive OSM attribution; no external map requests.
- Hide thinking traces and retrieval-cycle counts from the user-facing GUI. Keep any necessary model/tool limits internal.
- Keep project changes focused on the remaining PDF items and security/deployment correctness.

## Work plan

| ID | Task | Acceptance criteria | Status |
|---|---|---|---|
| 0 | Interactive demo chat and staged property response (previous work) | Sara’s greeting; one-at-a-time location → budget → area; 200–1500 ms variable pause and streamed replies; transparent closest-match path; staged location/price/area; plans only after installments; cash does not leak plan terms; confirmation/explore, rejection reason, and synthetic photos. | **Done** — core demo flow deployed in `619f47b`; the new-visitor default is now Arabic with the exact PDF greeting, and English remains user-selectable. Keep regression coverage. |
| 1 | Remove the problematic conversations menu completely | Remove `LeftPanel`, the chats/search toggle, left resize handle, mobile drawer/backdrop, and sidebar-only create/search/switch/delete controls. Keep one active thread and add a small in-chat restart action so the demo remains usable after completion. Do not add another composer/transcript. | **Done** — sidebar component, toggle, drawer, resize logic, and menu-only context APIs removed. A completed demo restarts in the same composer; desktop/mobile E2E verifies no history menu and only one composer. |
| 2 | Remove thinking-log banner and cycle-count controls | No thinking/status banner, cycle count, or associated Settings controls remain visible; any internal safety limit stays internal. | **Done** — removed Settings workflow/cycle tab, thinking-log toggle/state/storage, persisted-log rendering, and live status-card rendering. Provider path keeps only a fixed internal `maxCycles: 3`; E2E confirms no banner or cycle controls. |
| 3 | Replace 3D visualization with 2D Egypt map | Use a bundled detailed map and usable governorate boundaries; support zoom/pan, selection highlight/focus, and model-generated focus/drill directives. Keep the OSM credit inside the map; remove the named DEMO/map text below it. | **Done — grouped verification passed** — selected the detailed whole-Egypt OSM SVG and added a separate 29-region bilingual governorate path dataset. The map includes pan/zoom, selectable places and inventory markers, selected-place chat attachment, directive-driven focus/highlighting, and unobtrusive in-map OSM credit. Prior 3D/Three.js assets remain removed. |
| 4 | Add the demo analytics dashboard | Reachable without a sidebar; daily/weekly/monthly client counts, conversation/message counts, hot properties, hot locations, and useful inline-SVG charts. Add a conspicuous synthetic-data notice; counts and charts reconcile to the selected period. Update stale fixture reference dates so the dashboard has current demo periods. | **Done** — toolbar switches the right-side map panel to analytics, rather than opening analysis in chat. The chat/transcript/composer remain available. Day/week/month selectors, KPI counts, message bars, lead-stage chart, hot property/location rankings, bilingual copy, and synthetic notice are present. Fixture is dated 2026-11-07. |
| 5 | Make static demo/runtime claims safe and honest | GitHub Pages must not claim server-encrypted key storage or silently imply a secure live-agent backend where no backend exists. Clearly label/disable unavailable live features on static hosting; keep the no-key demo working. | **Done** — static-host detection locks the agent to no-key demo, blocks browser-local keys and provider calls, and replaces API-key controls with an explicit warning. Previously saved browser key data is not loaded and can be explicitly cleared; secure-backend mode remains separate. E2E verifies the no-key UI and legacy-key cleanup. |
| 6 | Update project documentation and remove dead UI/code | Preserve the explicitly requested URL-only root README; publish a demo guide and refresh the PDF audit against the completed app. Record map attribution/license; remove obsolete sidebar/3D/thinking-control references and unused dependencies/assets where safe. | **Done** — `README.md` remains the Pages URL only; `DEMO_GUIDE.md` documents synthetic data, the offline OSM map, selection/chat context, panel analytics, and static-host limits. The refreshed PDF audit identifies the unfilled company-name placeholder and subjective visual sign-off. The in-map OSM/ODbL credit is visible. Removed the superseded map-footer/list CSS and obsolete center-panel analytics layout styles. |
| 7 | Final grouped verification and deploy | Run typecheck, lint, unit tests, accessibility/E2E, secret scan, dependency audit, production/static build, then push and verify Pages/CI. Report PDF items done/not done by chat/persona, model/demo behavior, and GUI. | **Verification passed; push pending** — full `npm run verify` passed on the map refresh (118 unit tests, 9 E2E, clean secret scan, 0 dependency vulnerabilities, static build; lint has 12 warnings and no errors). The GitHub Pages base-path build also passed. Changes are committed locally as `8465ed8`; pushing and live deployment confirmation need fresh transient PAT authentication. |

## Verification checkpoints (batched, not after each task)

1. **Checkpoint A — after Tasks 1–3:** typecheck + unit tests + E2E/accessibility for the single-thread restart flow, removed sidebar, settings removals, and 2D map; then review visuals before continuing.
2. **Checkpoint B — after Tasks 4–5:** dashboard aggregation/date/chart checks, static-host feature disclosure checks, and updated E2E flows.
3. **Final checkpoint — after Tasks 6–7:** full `npm run verify`, clean diff/secret check, commit/push, confirm GitHub Actions/Pages success, and inspect the live URL.

### Checkpoint results

- **A:** after the corrected map locator/overlap and restart expectation, `npm run test:e2e` passed 6/6; the earlier full verify passed typecheck, 116 unit tests, secret scan, 0-vulnerability audit, and static build (lint had 15 warnings).
- **B:** `npm run verify` passed with the dashboard and static-key safety flows: typecheck, 116 unit tests, secret scan clean, 0 vulnerabilities, production static build, and 8/8 E2E. Lint had 13 warnings and no errors.
- **Previous deployed-release run (2026-11-07, commit `5c1b32f`):** `npm run verify` passed with 116/116 unit tests and 9/9 E2E; lint had 12 warnings and no errors. Static build, secret scan, dependency audit, and GitHub Pages deployment passed. This predates the current map refresh.
- **Map refresh checkpoint (2026-11-07):** integrations include the OSM base, 29 bilingual governorate paths, zoom/pan, user-message map metadata, model directive focus/highlighting, and analytics in the right map panel. `npm run verify` passed: 118/118 unit tests, 9/9 E2E, typecheck, static production build, secret scan, and 0-vulnerability audit; lint has 12 warnings/0 errors. The GitHub Pages base-path build passed. Commit `8465ed8` is complete; authenticated push and live deployment confirmation remain pending.

## Change log

- 2026-11-07: Created plan after the owner reported the left conversations menu still hides content unless hovered. Decision: remove the sidebar and its toggle/functionality rather than continue polishing it. Previous response-quality work is retained as Task 0.
- 2026-11-07: Selected the user-supplied detailed OSM SVG, generated dark local map and 29 bilingual governorate paths, connected map selection to chat context and agent visualization directives, and moved analytics to replace the map in its right-side panel. Grouped verification passed; authenticated push remains pending.
