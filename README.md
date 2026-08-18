# BloodNet — Smart Blood Donor Network

A network connecting donors, hospitals, and blood banks — a React frontend backed by a
real Express + MongoDB API (JWT cookie auth, bcrypt password hashing, server-generated
OTPs). Donor, Hospital, Blood Bank, and Admin all have real accounts; hospital/blood
bank accounts require Admin approval before they can log in. Emergency-request matching
ranks donors with a real trained XGBoost model (blended with distance, recency, response
rate, and donation count — see "Donor ranking" below), Socket.IO pushes live status/alert/
admin updates, and Leaflet/OpenStreetMap renders donor and hospital locations. See
"Known limitations" for what's still missing (Firebase push notifications, admin
broadcast announcements).

## Project structure

```
client/                          React 19 + TypeScript + Vite + shadcn/ui
├── src/
│   ├── components/
│   │   ├── ui/                   shadcn/ui primitives (button, dialog, form, table, tabs, ...)
│   │   ├── layout/                header, footer, theme toggle, language select, notifications bell
│   │   ├── home/                  hero, features, roles, FAQ, compatibility table
│   │   ├── auth/                  register/login/forgot-password/OTP flow, RequireRole guard
│   │   ├── hospital/               raise-request form, request cards
│   │   ├── blood-bank/            inventory form + grid
│   │   ├── profile/                travel mode, donor alerts, donation history
│   │   └── admin/                 charts + cards for the Insights page (blood-group donuts,
│   │                               network activity trend w/ range toggle, inventory bar chart,
│   │                               priority/availability donuts, ranked-list tables, KPI tiles)
│   ├── pages/                     one component per route — includes admin-page (approvals +
│   │                               alerts + activity), admin-insights-page (analytics only),
│   │                               admin-users-page (account search/suspend)
│   ├── store/                     zustand stores (session, requests, inventory, ui)
│   ├── hooks/                     shared hooks (donor notify, countdown, live count, geolocation)
│   ├── lib/                       API client, socket.io client, blood-compatibility, donor-eligibility,
│   │                               request-labels, format-duration, utils
│   ├── i18n/                      i18next setup; only `locales/en.json` is a real static dictionary —
│   │                               every other language is machine-translated on first use via
│   │                               POST /api/translate (Google Cloud Translation) and cached in
│   │                               localStorage (see `dynamic-backend.ts`)
│   └── types/                     shared domain types
├── index.html
└── vite.config.ts                 dev-mode proxies /api → the Express server

server/                          Express API + MongoDB (no view layer — serves client/dist)
├── index.js                      entry point: connects Mongo, starts the HTTP server + Socket.IO + cron jobs
├── app.js                        Express app factory: middleware, routes, SPA fallback
├── seed.js                        creates the Admin account from ADMIN_EMAIL/ADMIN_PASSWORD
├── seed-demo-donors.js           optional script to seed sample donor accounts for local testing
├── constants.js                   shared enums (blood groups, roles, priorities, approval states, radius steps)
├── config/env.js                  centralized env var access
├── db/connect.js                  mongoose connection
├── models/                        User, DonorProfile, HospitalProfile, BloodBankProfile,
│                                   BloodInventory, BloodRequest, DonorResponse, BloodBankResponse,
│                                   Donation, Notification, OtpToken, geo-point.schema (shared 2dsphere point)
├── routes/ + controllers/         auth, donors, hospital-requests, guest-requests, inventory,
│                                   admin (stats/analytics/trends/approvals/user-management),
│                                   notifications, search, translate
├── services/                      otp.service, donor-matching.service (rule-based candidate lookup),
│                                   priority-score.service (35/25/20/12/8 weighted ranking — AI
│                                   probability, distance, recency, response rate, donation count),
│                                   ai-prediction.service (calls the ML service, falls back to a
│                                   hand-tuned formula if it's unreachable), request-alert.service
│                                   (email/SMS fan-out), donor-stats.service (eligibility/badges),
│                                   geo.service (haversine + location parsing), certificate.service
│                                   (PDF donation certificates via pdfkit), notification.service,
│                                   user-view.service, blood-compatibility.service, translation.service
│                                   (Google Cloud Translation), mailer.service (Nodemailer), sms.service (Twilio)
├── jobs/                          eligibility-reminder.job (daily, donors eligible in 7 days),
│                                   escalation.job (every 2 min: widens search radius for stalled
│                                   requests, and progresses through ranked donors in priority tiers)
├── realtime/socket.js             Socket.IO: per-user rooms, per-hospital rooms, and an admin room
│                                   (emitToAdmins) that the Insights/Users pages listen to for live refresh
├── middleware/auth.js             JWT cookie issue/verify, requireAuth/requireRole
├── middleware/error-handler.js    last-resort error → JSON response
└── utils/                         async-handler (wraps async routes), delivery-error

ml/                               Python/Flask microservice — the real donor-availability model
├── app.py                         Flask API the Node server calls (ML_SERVICE_URL, default :5001)
├── generate_training_data.py     deterministic synthetic training data (seeded)
├── train_model.py                 trains and saves the XGBoost model to ml/model/
└── requirements.txt               flask, xgboost, pandas, numpy, scikit-learn

docker/start.sh                  runs the Node API and the Flask ML service as sibling processes
Dockerfile                       combined server+ML image for Fly.io (client deploys separately, e.g. Vercel)
fly.toml                         Fly.io deploy config for the combined server+ML image

docs/
├── design.md                              Design-reference notes (see below)
├── project-details.pdf                    Original academic project brief
└── smart-blood-donor-network-overview.pdf Project overview/report

.env.example                     Copy to .env and fill in before running
```

`docs/design.md` records what used to be an AI-generated (Lovable) multi-page design
prototype bundled as a zip in this repo — it's now a written reference instead of a
267 KB binary blob nobody could diff.

## Admin dashboards

Admin has three separate pages (linked from the header's Workspace menu), split by concern
rather than crammed into one:

- **`/admin`** — operational: pending hospital/blood-bank approvals, low-stock alerts, and
  a filterable feed of recent emergency requests.
- **`/admin/insights`** — analytics only: registered-donor/hospital/blood-bank counts,
  open emergencies, avg. fulfillment time, a donations + new-donor-signups trend chart
  (1M/3M/6M/1Y range toggle), blood-group demand vs. donor supply vs. inventory levels,
  requests by priority, donor availability, top cities, top hospitals, and a donor
  retention funnel. Updates live (see below) — no manual refresh needed while a signup,
  request, donation, or stock change happens elsewhere.
- **`/admin/users`** — search/filter donor, hospital, and blood-bank accounts by role,
  status, or email/phone, and suspend or reactivate any of them. Suspension is enforced
  at login (a currently-open session isn't force-revoked — see "Known limitations").

Live updates on the Insights and Users pages come from a Socket.IO admin room: donor/
hospital/blood-bank registration, new or completed requests, inventory changes, and
approval/suspension actions all broadcast a refresh signal (`admin:refresh`) to any
connected admin, with a 45s poll as a fallback.

## Donor ranking

Two related but separate ranking paths exist:

- **Emergency alerts** (`donor-matching.service.js`) use a simple rule-based score to pick
  who gets notified first when a request comes in.
- **Donor search results** shown to hospitals (`priority-score.service.js`) use a
  Priority Score out of 100, blending five weighted factors: AI availability probability
  (35%), distance (25%), days since last donation (20%), past response rate (12%), and
  total donation count (8%). The AI probability comes from a real trained XGBoost model
  (`ml/train_model.py`) served by the Flask microservice in `ml/`; if that service is
  unreachable, `ai-prediction.service.js` falls back to a hand-tuned formula so ranking
  never hard-fails.

## Running locally

Requires a MongoDB instance (local MongoDB Community Server, or a MongoDB Atlas
connection string).

```bash
npm install              # installs server deps + client deps (postinstall hook)
cp .env.example .env      # set MONGODB_URI, JWT_SECRET, ADMIN_EMAIL/ADMIN_PASSWORD,
                           # and SMTP / Twilio / Google Translate keys as needed
npm run seed               # creates the one Admin account from ADMIN_EMAIL/ADMIN_PASSWORD
npm run dev                # Vite dev server (5173) + Express API (3000), both live-reloading
```

Open **http://localhost:5173** — Vite proxies `/api/*` requests to the Express server
automatically (see `client/vite.config.ts`), so the frontend and backend behave as one
app in development while each gets independent hot-reload.

`npm run dev` also starts the ML service (`npm run dev:ml`) via `concurrently`, but it
needs a trained model first — run `npm run ml:setup && npm run ml:train` once (requires
Python 3). Without a trained model, or with `ML_SERVICE_URL` unset/unreachable, donor
ranking still works — it just uses the fallback formula instead of the real model.

Without SMTP/Twilio credentials configured, the app still runs — OTP email/SMS sending
fails gracefully with a clear, non-technical message in the UI, and in non-production
the generated OTP is also printed to the server console (`[dev-otp] ...`) so
registration/login can still be tested end to end. Without `GOOGLE_TRANSLATE_API_KEY`,
non-English languages fall back to English text instead of failing.

## Production build

```bash
npm run build   # builds client/dist
npm start        # node server/index.js — serves client/dist + the API on one port (3000)
```

`npm start` runs in the foreground, same as any other Node server — closing the
terminal (or Ctrl+C) stops it. If the frontend throws `Failed to fetch` on OTP/alert
requests, it means this process isn't running (or isn't reachable) — start it again.

The Dockerfile builds a combined server+ML image for Fly.io (`fly.toml`), training the
model at build time so the container never needs Python's ML stack installed at runtime
beyond what's already baked in; the client is deployed separately (e.g. Vercel) and isn't
part of this image.

## Environment variables

See `.env.example`. In short:
- `MONGODB_URI` — MongoDB connection string (defaults to `mongodb://127.0.0.1:27017/bloodnet`).
- `JWT_SECRET` / `JWT_EXPIRES_IN` — session cookie signing.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — used only by `npm run seed` to create the single
  Admin account (Admin has no self-registration form).
- `SMTP_*` — Gmail (or other SMTP) credentials for sending OTP/alert emails.
- `TWILIO_*` — Twilio credentials for sending OTP/alert SMS. Optional; SMS features
  fail gracefully with a clear message if unset (with an OTP fallback logged to the
  server console outside production).
- `GOOGLE_TRANSLATE_API_KEY` — Google Cloud Translation API key. Optional; without it,
  every non-English language falls back to English.
- `ML_SERVICE_URL` — where the Node server reaches the Flask ML service (defaults to
  `http://127.0.0.1:5001`, matching the Dockerfile's same-container setup).

## Other scripts

- `npm run typecheck` — TypeScript project check for the client (no emit).
- `npm run lint` — [oxlint](https://oxc.rs/docs/guide/usage/linter.html) for the client.
- `npm test` — server test suite (Vitest + Supertest + an in-memory MongoDB).
- `npm run test:watch` — the same suite in watch mode.
- `npm run test:coverage` — the suite with a v8 coverage report (`coverage/`).
- `npm run ml:setup` — installs the ML service's Python dependencies.
- `npm run ml:train` — generates deterministic synthetic training data and trains the
  XGBoost model into `ml/model/`.

## Testing

Server tests live under `server/**/*.test.js` — unit tests colocated with the module
they cover (`server/services/*.test.js`, `server/jobs/*.test.js`, ...), integration
tests (real Express routes via Supertest) under `server/test/integration/`. There's no
client or ML test suite yet — see "Known limitations".

```bash
npm test              # run once
npm run test:watch     # re-run on change
npm run test:coverage  # with a coverage report
```

What makes this safe to run locally without touching anything real:

- **Database**: `server/test/global-setup.js` starts an isolated **in-memory** MongoDB
  (`mongodb-memory-server`) once for the whole run; nothing ever touches your real
  `MONGODB_URI`. Every collection is wiped between individual tests
  (`server/test/setup.js`).
- **Email/SMS/Translate**: the same file blanks `SMTP_*`, `TWILIO_*`, and
  `GOOGLE_TRANSLATE_API_KEY` in `process.env` *before* `server/config/env.js` loads
  `.env` — dotenv never overwrites a variable that's already set, so this holds even if
  you have real credentials in your local `.env`. OTP flows still work end-to-end in
  tests via the same `[dev-otp] ...` console fallback the app already uses when those
  integrations aren't configured (see `server/test/helpers.js`'s `captureDevOtp`).
- **ML service**: `ML_SERVICE_URL` is left pointing at its default (unreachable in
  tests) address, so donor-ranking tests exercise the real fallback formula in
  `ai-prediction.service.js` rather than a mock.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `Integration`/`main` and on every pull
request targeting either — three parallel jobs: lint, typecheck, the server test suite
(with a coverage artifact), and a real `vite build` of the client. No secrets required,
and it never deploys anything.

Deployment to Fly.io (server + ML service) and Vercel (client) is already configured
outside of this repo's GitHub Actions — each platform's own auto-deploy-on-push handles
shipping a merge to `main`, independent of CI.

## Known limitations

- No client or ML (Python/Flask) automated tests yet — only the server has a test
  suite (see "Testing" above).
- No Firebase (or other) push notifications — emergency alerts and eligibility
  reminders go out via Socket.IO (only while the recipient is connected), email, and
  SMS, with no channel that reaches a donor who's both offline and away from their
  phone's inbox/messages.
- Maps use Leaflet/OpenStreetMap rather than Google Maps.
- Admin can't send broadcast announcements to donors/hospitals; account management
  (`/admin/users`) covers search/suspend/reactivate but not editing profile fields or
  hard-deleting an account.
- Suspending a user takes effect at their next login, not instantly — sessions are
  stateless JWT cookies with no server-side revocation list, so an already-logged-in
  suspended user keeps working until their cookie expires (up to 7 days). This mirrors
  the pre-existing hospital/blood-bank approval gate, which has the same characteristic.
- Blood bank inventory is owned per-bank (each blood bank manages its own stock);
  public/admin views show totals aggregated across all banks.
