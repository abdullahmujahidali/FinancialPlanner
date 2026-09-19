# Trusses — the family financial backbone

Multi-tenant household finance PWA. Expenses with pass-through / one-off flags, optional
per-person tagging, bank-CSV import with a self-learning rules engine, assets with value
history and net worth, savings goals with an under-budget incentive split.

Stack: Next.js 14 (app router, server actions) · Drizzle ORM · Neon Postgres · Tailwind · PWA.

## Setup (10 minutes)

1. **Database** — create a free project at neon.tech, copy the pooled connection string.
2. **Env** — `cp .env.example .env`, fill `DATABASE_URL` and a random `SESSION_SECRET`.
3. **Install & push schema**
   ```bash
   npm install
   npm run db:push        # creates all tables on Neon
   ```
4. **Seed your household** (accounts, buckets, people, mined import rules):
   ```bash
   SEED_OWNER_EMAIL=you@... SEED_OWNER_PASSWORD=... \
   SEED_MEMBER_EMAIL=wife@... SEED_MEMBER_PASSWORD=... npm run seed
   ```
   Skip the seed entirely if you want a clean instance — signup at `/login?mode=signup`
   creates a fresh household with sensible defaults (that's the multi-tenant path any
   other family uses).
5. **Run** — `npm run dev`, open http://localhost:3000.

## Deploy (Vercel)

Push to GitHub → import in Vercel → set `DATABASE_URL` + `SESSION_SECRET` env vars → deploy.
Open the URL on your phone → Add to Home Screen → it installs as the Trusses app.

## How the ledger thinks

- **Everything is scoped by household** — one query filter, enforced in every action.
  Sharing with another family = they sign up; nothing else changes.
- **Pass-through** expenses (reimbursed bills) are excluded from budget actuals.
- **Transfers** (including ATM → Cash wallet, auto-detected on import) are money moving,
  not money spent — excluded from spend.
- **Savings** = budget − spend (when positive); the incentive % of it is shown on the
  dashboard for the analyst's payout.
- **Import**: Meezan CSV format (preamble + Booking Date header). Duplicates skipped by
  fingerprint, reversal pairs netted, balance tie-out verified against the statement's
  opening/closing. Unknowns land in `/review`; resolving one with "remember" creates a
  rule, so imports get more automatic every month.
- **Assets** keep purchase date/price plus a value history → current net worth, per-asset
  appreciation/depreciation, and a bought-by-year view. Quarterly revaluation nudge after
  90 days.
- **Goals** accept contributions and can convert into an asset on completion.

## v1 notes / roadmap

- Attachments are stored in Postgres (2 MB cap) to keep infra at zero; move to
  Cloudflare R2 when volume grows (schema already isolates them in `attachments`).
- Other banks' CSV formats: add a parser beside `src/lib/meezan.ts` and a format picker
  on `/import`.
- Auth is email+password with JWT cookie; add magic links / password reset before
  opening to families outside your circle.
- Bank balances aren't part of net worth yet (assets only) — add if wanted.
