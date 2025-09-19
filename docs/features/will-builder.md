Affluvia Will Builder (Preview)

Overview
- Adds a minimal, FreeWill-style will draft generator.
- Server endpoint: `POST /api/wills/generate` returns links to generated HTML documents under `/uploads/wills/{userId}-{timestamp}/`.
- Client entry point: Estate Planning Center → Document Tracker → "Create a Will Draft" button.

Endpoints
- GET `/api/wills/current` — Returns saved will form (or a default synthesized from financial profile).
- POST `/api/wills` — Saves will form JSON into `financial_profiles.estate_planning.will`.
- POST `/api/wills/generate` — Generates HTML drafts: instructions, last will, personal property memo, digital assets sheet, funeral wishes, and beneficiary messages. Returns array of `{ kind, urlPath }`.

Templates
- Implemented as server-side HTML renderers in `server/services/will/templates.ts`.
- Deterministic output; no randomization.

Storage
- Files written to `uploads/wills/{userId}-{timestamp}/`.
- A draft row is also created in `estate_documents` with `documentType: 'will'`.

Notes
- PDF export can be added by swapping the HTML writer with a headless browser renderer (Playwright/Puppeteer). Current implementation focuses on HTML for speed and portability.

