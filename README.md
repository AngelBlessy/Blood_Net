# BloodNet — Smart Blood Donor Network

A network connecting donors, hospitals, and blood banks — a React frontend backed by a
real Express + MongoDB API (JWT cookie auth, bcrypt password hashing, server-generated
OTPs). Donor, Hospital, Blood Bank, and Admin all have real accounts; hospital/blood
bank accounts require Admin approval before they can log in. Donor matching for
emergency requests uses a simple rule-based ranking (blood-group compatibility,
availability, days since last donation, past response rate) — no ML model, maps, or
push notifications yet, see "Known limitations".

## Project structure

```
client/                          React 19 + TypeScript + Vite + shadcn/ui
├── src/
│   ├── components/
│   │   ├── ui/                   shadcn/ui primitives (button, dialog, form, ...)
│   │   ├── layout/                header, footer, theme toggle, language select
│   │   ├── home/                  hero, features, roles, FAQ, compatibility table
│   │   ├── auth/                  register/login/forgot-password/OTP flow
│   │   ├── hospital/               raise-request form, request cards
│   │   ├── blood-bank/            inventory form + grid
│   │   └── profile/                travel mode, donor alerts
│   ├── pages/                     one component per route
│   ├── store/                     zustand stores (users, session, requests, inventory)
│   ├── hooks/                     shared hooks (donor notify, countdown, live count)
│   ├── lib/                       crypto, blood-compatibility, API client, utils
│   ├── i18n/                      i18next setup + 12 language JSON dictionaries
│   └── types/                     shared domain types
├── index.html
└── vite.config.ts                 dev-mode proxies /api → the Express server

server/                          Express API + MongoDB (no view layer — serves client/dist)
├── index.js                      entry point: connects Mongo, starts the HTTP server + cron job
├── app.js                        Express app factory: middleware, routes, SPA fallback
├── seed.js                        creates the Admin account from ADMIN_EMAIL/ADMIN_PASSWORD
├── constants.js                   shared enums (blood groups, roles, priorities, approval states)
├── config/env.js                  centralized env var access
├── db/connect.js                  mongoose connection
├── models/                        User, DonorProfile, HospitalProfile, BloodBankProfile,
│                                   BloodInventory, BloodRequest, DonorResponse, Donation,
│                                   Notification, OtpToken
├── routes/ + controllers/         auth, donors, hospital-requests, inventory, admin, notifications
├── services/                      otp.service (server-side OTP issue/verify), donor-matching.service
│                                   (rule-based ranking), request-alert.service (email/SMS fan-out),
│                                   donor-stats.service (eligibility/badges), user-view.service,
│                                   blood-compatibility.service, mailer.service (Nodemailer),
│                                   sms.service (Twilio)
├── jobs/eligibility-reminder.job.js  daily check for donors becoming eligible in 7 days
├── middleware/auth.js             JWT cookie issue/verify, requireAuth/requireRole
├── middleware/error-handler.js    last-resort error → JSON response
└── utils/                         async-handler (wraps async routes), delivery-error

docs/
├── design.md                              Design-reference notes (see below)
├── project-details.pdf                    Original academic project brief
└── smart-blood-donor-network-overview.pdf Project overview/report

.env.example                     Copy to .env and fill in before running
```

`docs/design.md` records what used to be an AI-generated (Lovable) multi-page design
prototype bundled as a zip in this repo — it's now a written reference instead of a
267 KB binary blob nobody could diff.

## Running locally

Requires a MongoDB instance (local MongoDB Community Server, or a MongoDB Atlas
connection string).

```bash
npm install              # installs server deps + client deps (postinstall hook)
cp .env.example .env      # set MONGODB_URI, JWT_SECRET, ADMIN_EMAIL/ADMIN_PASSWORD,
                           # and SMTP / Twilio keys as needed
npm run seed               # creates the one Admin account from ADMIN_EMAIL/ADMIN_PASSWORD
npm run dev                # Vite dev server (5173) + Express API (3000), both live-reloading
```

Open **http://localhost:5173** — Vite proxies `/api/*` requests to the Express server
automatically (see `client/vite.config.ts`), so the frontend and backend behave as one
app in development while each gets independent hot-reload.

Without SMTP/Twilio credentials configured, the app still runs — OTP email/SMS sending
fails gracefully with a clear, non-technical message in the UI, and in non-production
the generated OTP is also printed to the server console (`[dev-otp] ...`) so
registration/login can still be tested end to end.

## Production build

```bash
npm run build   # builds client/dist
npm start        # node server/index.js — serves client/dist + the API on one port (3000)
```

`npm start` runs in the foreground, same as any other Node server — closing the
terminal (or Ctrl+C) stops it. If the frontend throws `Failed to fetch` on OTP/alert
requests, it means this process isn't running (or isn't reachable) — start it again.

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

## Other scripts

- `npm run typecheck` — TypeScript project check for the client (no emit).
- `npm run lint` — [oxlint](https://oxc.rs/docs/guide/usage/linter.html) for the client.

## Known limitations

- No automated tests or CI yet.
- Donor ranking is a simple rule-based formula (blood-group compatibility,
  availability, days since last donation, past response rate) — no ML model, no
  geolocation/distance (the UI doesn't collect donor/hospital coordinates), no Google
  Maps, no Firebase push notifications, no Socket.IO live updates. The home page and
  hospital/admin dashboards poll on a short interval instead of pushing live updates.
- Blood bank inventory is now owned per-bank (each blood bank manages its own stock);
  public/admin views show totals aggregated across all banks.
