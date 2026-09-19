import Link from "next/link";
import type { Metadata } from "next";
import { currentUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Upload,
  Inbox,
  Target,
  Building2,
  Users,
  ShieldCheck,
  Check
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hearthbook — the family's one book",
  description:
    "A household ledger for families who actually talk about money. Import the bank statement, agree on what each line was, watch the savings add up.",
  openGraph: {
    title: "Hearthbook — the family's one book",
    description:
      "A household ledger for families who actually talk about money.",
    type: "website"
  }
};

/**
 * Public marketing page. Lives outside the auth wall (see middleware) and
 * deliberately does not import Shell — no sidebar, no session, no DB.
 *
 * Follows the app's own design system rather than inventing a second one: the
 * same acid/ink/blush zones, the same 22px geometry, the same oversized
 * display figures. Someone who signs up should recognise the product.
 */
export default async function Welcome() {
  // A logged-in family lands on their ledger, not the sales pitch.
  if (await currentUserId()) redirect("/");

  return (
    <main className="min-h-screen bg-page">
      <Header />
      <Hero />
      <ProofStrip />
      <Features />
      <Flow />
      <Tenancy />
      <Closer />
      <Footer />
    </main>
  );
}

/* -------------------------------------------------------------------------- */

function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/welcome" className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/logo.svg"
        alt=""
        width={34}
        height={34}
        className="rounded-[9px]"
      />
      <span
        className={
          "font-display text-[19px] font-extrabold tracking-[-0.03em] " +
          (dark ? "text-white" : "text-ink")
        }
      >
        Hearthbook
      </span>
    </Link>
  );
}

function Header() {
  return (
    <header className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-5 lg:px-10 lg:py-7">
      <Wordmark />
      <nav className="flex items-center gap-2">
        <Link
          href="/login"
          className="hidden rounded-full px-4 py-2.5 text-[14px] font-bold text-ink transition hover:bg-card sm:inline-flex"
        >
          Sign in
        </Link>
        <Link href="/login?mode=signup" className="btn btn-sm sm:px-5 sm:py-3">
          Start your book
        </Link>
      </nav>
    </header>
  );
}

/* --- Hero ----------------------------------------------------------------- */

function Hero() {
  return (
    <section className="mx-auto max-w-[1180px] px-5 pb-6 lg:px-10">
      <div className="zone-acid overflow-hidden lg:p-12">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div>
            <p className="eyebrow mb-5 lg:mb-6">The family ledger</p>
            <h1 className="font-display text-[40px] font-extrabold leading-[0.92] tracking-[-0.045em] sm:text-[56px] lg:text-[72px]">
              Every rupee,
              <br />
              in one book.
            </h1>
            <p className="mt-6 max-w-[42ch] text-[16px] font-semibold leading-relaxed lg:mt-7 lg:text-[18px]">
              Hearthbook replaces the household spreadsheet. Import the bank
              statement, agree on what each line was, and watch the month's
              savings add up — together, not in someone's head.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:mt-10">
              <Link href="/login?mode=signup" className="btn justify-center">
                Start your book <ArrowRight size={17} />
              </Link>
              <Link href="/login" className="btn-quiet justify-center">
                Sign in
              </Link>
            </div>
            <p className="mt-5 text-[13px] font-semibold opacity-70">
              Free while it's just your family. No card, no bank login.
            </p>
          </div>

          <HeroCard />
        </div>
      </div>
    </section>
  );
}

/**
 * A honest-looking slice of the real dashboard: budget ring, the month's
 * figure, a couple of ledger rows. Static markup — it's an illustration, not a
 * live widget, so it costs nothing to render.
 */
function HeroCard() {
  const spent = 268_400;
  const budget = 350_000;
  const pct = Math.round((spent / budget) * 100);

  return (
    <div className="card p-5 shadow-soft lg:p-7">
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow text-muted">Spent in September</p>
          <p className="money-xl mt-2 text-[38px] lg:text-[46px]">
            ₨ 268,400
          </p>
        </div>
        <span className="tag-acid shrink-0">On track</span>
      </div>

      {/* Budget bar: filled to pct, the remainder hatched like the app's. */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between text-[12px] font-bold">
          <span className="text-muted">of ₨ 350,000 budget</span>
          <span className="num">{pct}%</span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-page">
          <div
            className="h-full rounded-full bg-ink"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-6 space-y-0.5">
        <Row label="Groceries" sub="Imtiaz Super Market" amount="₨ 18,240" />
        <Row label="LESCO bill" sub="Reimbursed" amount="₨ 9,860" pass />
        <Row label="ATM withdrawal" sub="→ Cash wallet" amount="₨ 25,000" transfer />
      </div>

      <div className="mt-6 flex items-center justify-between rounded-[14px] bg-acid px-4 py-3.5">
        <span className="text-[13px] font-bold">Savings so far</span>
        <span className="money text-[18px] font-extrabold">₨ 81,600</span>
      </div>
    </div>
  );
}

function Row({
  label,
  sub,
  amount,
  pass = false,
  transfer = false
}: {
  label: string;
  sub: string;
  amount: string;
  pass?: boolean;
  transfer?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-[14px] font-bold">{label}</p>
        <p className="truncate text-[12px] font-semibold text-muted">{sub}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {pass && <span className="tag-blush">Passthrough</span>}
        {transfer && <span className="tag-muted">Transfer</span>}
        <span
          className={
            "money text-[14px] font-bold " +
            (pass || transfer ? "text-muted line-through decoration-1" : "")
          }
        >
          {amount}
        </span>
      </div>
    </div>
  );
}

/* --- Proof strip ---------------------------------------------------------- */

function ProofStrip() {
  const stats: Array<[string, string]> = [
    ["58/58", "rows parsed from a real Meezan statement"],
    ["0", "bank credentials asked for, ever"],
    ["1", "book the whole family reads"]
  ];
  return (
    <section className="mx-auto max-w-[1180px] px-5 py-3 lg:px-10">
      <div className="zone-ink grid gap-7 sm:grid-cols-3 lg:p-10">
        {stats.map(([figure, caption]) => (
          <div key={caption}>
            <p className="money-xl text-[36px] text-acid lg:text-[44px]">
              {figure}
            </p>
            <p className="mt-2.5 max-w-[24ch] text-[13px] font-semibold leading-snug text-white/70">
              {caption}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --- Features ------------------------------------------------------------- */

const FEATURES = [
  {
    Icon: Upload,
    title: "Import, don't type",
    body: "Drop in the bank CSV. Duplicates are fingerprinted away, reversal pairs net out, and the balance is tied back to the statement's own opening and closing figures."
  },
  {
    Icon: Inbox,
    title: "A review queue, not an argument",
    body: "Anything unclear lands in Review. Tooba asks \"what was this?\", the answer sticks to the transaction, and \"remember as rule\" means it's never asked again."
  },
  {
    Icon: Target,
    title: "Goals that become things",
    body: "Save toward the next car. When a goal completes it converts into an asset, so the thing you bought keeps showing up in your net worth."
  },
  {
    Icon: Building2,
    title: "Assets with a memory",
    body: "Purchase price, value history, and a nudge when a valuation goes stale past 90 days. Net worth is the latest honest number, not the one you first paid."
  },
  {
    Icon: Users,
    title: "Per-person, or the whole house",
    body: "Tag a spend to a person or leave it with the household. The year view breaks the whole thing down either way."
  },
  {
    Icon: ShieldCheck,
    title: "Read-only by design",
    body: "Hearthbook never touches your bank. It reads statements you export yourself, which means there is no login to leak and nothing to move."
  }
];

function Features() {
  return (
    <section className="mx-auto max-w-[1180px] px-5 py-10 lg:px-10 lg:py-16">
      <div className="mb-8 lg:mb-12">
        <p className="eyebrow text-muted">What's inside</p>
        <h2 className="mt-3 max-w-[18ch] font-display text-[30px] font-extrabold leading-[1.02] tracking-[-0.035em] lg:text-[46px]">
          Built for how a family actually does this.
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ Icon, title, body }) => (
          <div key={title} className="zone-card shadow-soft">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-[13px] bg-acid">
              <Icon size={20} strokeWidth={2.4} />
            </span>
            <h3 className="mt-5 text-[18px] font-extrabold tracking-[-0.02em]">
              {title}
            </h3>
            <p className="mt-2.5 text-[14px] font-medium leading-relaxed text-muted">
              {body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --- Flow ----------------------------------------------------------------- */

const STEPS = [
  {
    n: "01",
    title: "Export your statement",
    body: "Download the month's CSV from your bank the way you always have. Nothing to connect, nothing to authorise."
  },
  {
    n: "02",
    title: "Import and sort",
    body: "Hearthbook categorises what it recognises and sets aside what it doesn't. You only look at the handful it wasn't sure about."
  },
  {
    n: "03",
    title: "Close the month",
    body: "Spend against budget, savings, and each person's share — settled, shared, and ready for the next statement."
  }
];

function Flow() {
  return (
    <section className="mx-auto max-w-[1180px] px-5 pb-10 lg:px-10 lg:pb-16">
      <div className="zone-blush lg:p-12">
        <p className="eyebrow">How a month goes</p>
        <div className="mt-8 grid gap-8 lg:mt-12 lg:grid-cols-3 lg:gap-10">
          {STEPS.map(({ n, title, body }) => (
            <div key={n}>
              <p className="money text-[13px] font-extrabold">{n}</p>
              <div className="mt-3 h-px w-full bg-ink/20" />
              <h3 className="mt-5 text-[20px] font-extrabold tracking-[-0.025em]">
                {title}
              </h3>
              <p className="mt-2.5 max-w-[34ch] text-[14px] font-semibold leading-relaxed text-ink/75">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --- Tenancy -------------------------------------------------------------- */

const PROMISES = [
  "Your household's data is isolated from every other household",
  "No bank credentials — statements are exported by you",
  "Invite the people you share money with, at the role you choose",
  "Install it to your home screen and it works like an app"
];

function Tenancy() {
  return (
    <section className="mx-auto max-w-[1180px] px-5 pb-10 lg:px-10 lg:pb-16">
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="zone-card shadow-soft lg:p-10">
          <p className="eyebrow text-muted">One book per household</p>
          <h2 className="mt-3 font-display text-[28px] font-extrabold leading-[1.05] tracking-[-0.03em] lg:text-[38px]">
            Your family's book is yours alone.
          </h2>
          <p className="mt-5 text-[15px] font-medium leading-relaxed text-muted">
            Every figure in Hearthbook belongs to exactly one household. Sign up
            and you get your own — separate accounts, categories, people and
            history, with nothing pooled and nothing shared by accident.
          </p>
        </div>

        <div className="zone-ink lg:p-10">
          <p className="eyebrow text-acid">What we promise</p>
          <ul className="mt-7 space-y-4">
            {PROMISES.map((p) => (
              <li key={p} className="flex items-start gap-3.5">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-acid">
                  <Check size={14} strokeWidth={3} className="text-ink" />
                </span>
                <span className="text-[15px] font-semibold leading-snug text-white/85">
                  {p}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* --- Closer --------------------------------------------------------------- */

function Closer() {
  return (
    <section className="mx-auto max-w-[1180px] px-5 pb-10 lg:px-10 lg:pb-16">
      <div className="zone-acid text-center lg:p-16">
        <h2 className="mx-auto max-w-[16ch] font-display text-[34px] font-extrabold leading-[0.98] tracking-[-0.04em] lg:text-[58px]">
          Close this month properly.
        </h2>
        <p className="mx-auto mt-5 max-w-[46ch] text-[16px] font-semibold lg:text-[18px]">
          Set your budget, import one statement, and see where the month
          actually went. It takes about ten minutes.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/login?mode=signup" className="btn justify-center">
            Start your book <ArrowRight size={17} />
          </Link>
          <Link href="/login" className="btn-quiet justify-center">
            I already have one
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mx-auto max-w-[1180px] px-5 pb-12 lg:px-10">
      <div className="flex flex-col items-start justify-between gap-5 border-t border-line pt-8 sm:flex-row sm:items-center">
        <Wordmark />
        <p className="text-[13px] font-semibold text-muted">
          Expenses, assets, goals — the family's one book.
        </p>
      </div>
    </footer>
  );
}
