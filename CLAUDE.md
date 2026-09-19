# Hearthbook — family finance ledger (context for Claude Code)

Household finance PWA for the Mujahid family (owner: Abdullah; daily user: Tooba, the
family's "financial analyst"). Built to replace a Google Sheet. Multi-tenant from day
one so other families can sign up later and get their own isolated household.

## Stack
Next.js 14 app router (server components + server actions, almost no client JS) ·
Drizzle ORM · Neon Postgres (serverless driver) · Tailwind · jose JWT cookie auth ·
PWA (manifest + sw.js). tsconfig: `strictNullChecks` must stay **on** (drizzle types
collapse without it).

## Domain rules (do not "simplify" these away)
- Every query filters by `household_id`. Tenancy is the product.
- `type`: expense | income | transfer. Transfers (incl. ATM → "Cash wallet") are NOT
  spend. Cash is just another account.
- `is_passthrough`: reimbursed bills (LESCO/PTCL/SNGPL/society) — excluded from budget
  actuals. `is_abnormal`: one-offs. `needs_review`: review queue / Tooba's questions.
- Budget: PKR 350,000/month, revised quarterly. Savings = budget − spend; Tooba's
  incentive = 10% of savings (both configurable in Settings, owner-only).
- `person_id` nullable → null means whole household. People: Abdullah, Tooba, Miral, Haroon.
- Assets carry purchase date/price + value history (`asset_values`); net worth = latest
  value per active asset. 90-day revaluation nudge on dashboard. Goals can convert to
  assets on completion (the live case: selling the Corolla to fund a ~45-lakh car).
- No liabilities module by design ("collect, then buy").

## Import pipeline (src/lib/meezan.ts + src/lib/rules.ts + src/actions/importer.ts)
Meezan CSV: preamble rows (opening/closing balance) then `Booking Date,...` header.
Dedupe via sha1 fingerprint (unique per household). Reversal pairs (ADJUSTMENT
Rev/Debit, same STAN) netted out. Built-ins: bank charges → Fees, ATM → transfer to
cash, salary/remittance → income. User rules = uppercase substring on description,
learned from the review queue ("remember as rule"). Balance tie-out verified against
statement opening/closing. **Verified against a real Sep-2026 statement: 58/58 rows,
tie-out exact.**

## State
- Code complete + `next build` green. NOT yet deployed to Vercel.
- Database EXISTS — do not create another one. Neon project `family-finance-sg`
  (id `aged-frog-35109366`, pg 18, **ap-southeast-1 / Singapore**). Schema +
  data were migrated here from the old us-east-1 project `family-finance`
  (`young-mud-84022016`) on 2026-09-19 via pg_dump/psql; row counts and the
  expense total were verified identical. The old project still exists as a
  fallback but is NOT used — delete it once you're confident.
  Singapore is ~154ms from PK vs ~245ms for us-east-1, and `vercel.json` pins
  functions to `sin1` so the prod server→DB hop is same-region.
  Get DATABASE_URL from console.neon.tech → family-finance-sg → Connect (or the
  Neon MCP get_connection_string). The seed script is idempotent (exits if owner
  exists) — safe but unnecessary to re-run.
- Login: abdullahmujahidali1@gmail.com / testpass123 ·
  toobashahzad06@gmail.com / testpass123. No password-change UI yet (roadmap).
- Attachments stored base64 in Postgres, 2 MB cap (move to Cloudflare R2 later).
- Seed script (`scripts/seed.mts`) creates the Mujahid household, 5 accounts (Meezan,
  Bank Al Habib, Faysal, MCB, Cash wallet), 12 categories, 4 people, 10 mined import
  rules. Does NOT seed assets/goals — Abdullah adds real figures in-app.

## Next steps (in order)
1. `.env` is already written (Singapore DATABASE_URL + SESSION_SECRET) and is
   gitignored, as is `.env.backup-us-east-1` (the old us-east-1 URL).
2. `npm install && npm run dev` to verify locally.
3. Deploy to Vercel (`vercel` CLI or dashboard import of the GitHub repo);
   set DATABASE_URL + SESSION_SECRET env vars. Add to Home Screen = PWA.
4. In-app: change both passwords is NOT possible yet — build a password-change
   form in Settings early. Then add Corolla + LDA plot assets and the car goal
   with real figures. Tooba starts October 2026.

## Roadmap (agreed, not started)
R2 attachments · more bank CSV parsers (format picker on /import) · password change + reset /
magic links before inviting outside families · optional bank balances in net worth.
