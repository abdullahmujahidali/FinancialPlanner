import Link from "next/link";
import type { Metadata } from "next";
import { currentUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import LandingDemo from "@/components/LandingDemo";
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
  title: "Housetally — every rupee, tallied",
  description:
    "A shared ledger for families who actually talk about money. Import your bank statement, agree on what each line was, and watch the month's savings add up.",
  openGraph: {
    title: "Housetally — every rupee, tallied",
    description: "A shared ledger for families who actually talk about money.",
    type: "website"
  }
};

/**
 * Public marketing page. Lives outside the auth wall (see middleware) and
 * deliberately does not import Shell — no sidebar, no session, no DB.
 *
 * Follows the app's own design system rather than inventing a second one: the
 * same acid/ink/blush zones, the same 22px geometry, the same oversized display
 * figures. Someone who signs up should recognise the product they just saw.
 *
 * Copy stays generic — no bank names, no household-specific terms — because
 * this has to sell to any family, not only the one that built it.
 */
export default async function Welcome() {
  // A logged-in family lands on their ledger, not the sales pitch.
  if (await currentUserId()) redirect("/");

  return (
    <main className="min-h-screen bg-page">
      <Header />
      <Hero />
      <ProofStrip />
      <Demo />
      <Features />
      <Tenancy />
      <Closer />
      <Footer />
    </main>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * One shared page gutter. Content runs edge-to-edge on large monitors rather
 * than sitting in a narrow column — the zones are the layout, so they should
 * use the screen they're given.
 */
const SHELL = "mx-auto w-full max-w-[1800px] px-4 sm:px-6 lg:px-10 2xl:px-14";

function Wordmark() {
  return (
    <Link href="/welcome" className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/logo.svg" alt="" width={34} height={34} className="rounded-[9px]" />
      <span className="font-display text-[19px] font-extrabold tracking-[-0.03em] text-ink">
        Housetally
      </span>
    </Link>
  );
}

function Header() {
  return (
    <header className={`${SHELL} flex items-center justify-between py-5 lg:py-7`}>
      <Wordmark />
      <nav className="flex items-center gap-2">
        <Link
          href="/login"
          className="hidden rounded-full px-4 py-2.5 text-[14px] font-bold text-ink transition hover:bg-card sm:inline-flex"
        >
          Sign in
        </Link>
        <Link href="/login?mode=signup" className="btn btn-sm sm:px-5 sm:py-3">
          Start your tally
        </Link>
      </nav>
    </header>
  );
}

/* --- Hero ----------------------------------------------------------------- */

function Hero() {
  return (
    <section className={`${SHELL} pb-4`}>
      <div className="zone-acid overflow-hidden lg:p-12 2xl:p-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 2xl:gap-20">
          <div>
            <p className="eyebrow mb-5 lg:mb-6">The shared family ledger</p>
            <h1 className="font-display text-[40px] font-extrabold leading-[0.92] tracking-[-0.045em] sm:text-[56px] lg:text-[72px] 2xl:text-[88px]">
              Every rupee,
              <br />
              tallied.
            </h1>
            <p className="mt-6 max-w-[46ch] text-[16px] font-semibold leading-relaxed lg:mt-7 lg:text-[18px] 2xl:text-[20px]">
              Housetally replaces the household spreadsheet. Import your bank
              statement, agree on what each line actually was, and watch the
              month's savings add up — together, not in one person's head.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:mt-10">
              <Link href="/login?mode=signup" className="btn justify-center">
                Start your tally <ArrowRight size={17} />
              </Link>
              <Link href="#demo" className="btn-quiet justify-center">
                See how it works
              </Link>
            </div>
            <p className="mt-5 text-[13px] font-semibold opacity-70">
              Free for your family. No card, and never your bank password.
            </p>
          </div>

          <HeroCard />
        </div>
      </div>
    </section>
  );
}

/** An honest slice of the real dashboard. Static — it illustrates, nothing more. */
function HeroCard() {
  const pct = Math.round((268_400 / 350_000) * 100);

  return (
    <div className="card p-5 shadow-soft lg:p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow text-muted">Spent this month</p>
          <p className="money-xl mt-2 text-[38px] lg:text-[46px] 2xl:text-[54px]">₨ 268,400</p>
        </div>
        <span className="tag-acid shrink-0">On track</span>
      </div>

      <div className="mt-6">
        <div className="flex items-baseline justify-between text-[12px] font-bold">
          <span className="text-muted">of ₨ 350,000 budget</span>
          <span className="num">{pct}%</span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-page">
          <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-6">
        <Row label="Groceries" sub="Supermarket" amount="₨ 18,240" />
        <Row label="Electricity bill" sub="Reimbursed" amount="₨ 9,860" pass />
        <Row label="ATM withdrawal" sub="→ Cash wallet" amount="₨ 25,000" transfer />
      </div>

      <div className="mt-6 flex items-center justify-between rounded-[14px] bg-acid px-4 py-3.5">
        <span className="text-[13px] font-bold">Saved so far</span>
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
  const excluded = pass || transfer;
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
            (excluded ? "text-muted line-through decoration-1" : "")
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
    ["0", "bank passwords asked for, ever"],
    ["1", "ledger the whole family reads"],
    ["10 min", "to import a statement and close the month"]
  ];
  return (
    <section className={`${SHELL} py-4`}>
      <div className="zone-ink grid gap-7 sm:grid-cols-3 lg:p-10 2xl:p-12">
        {stats.map(([figure, caption]) => (
          <div key={caption}>
            <p className="money-xl text-[36px] text-acid lg:text-[44px] 2xl:text-[52px]">
              {figure}
            </p>
            <p className="mt-2.5 max-w-[26ch] text-[13px] font-semibold leading-snug text-white/70 2xl:text-[14px]">
              {caption}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --- Interactive demo ----------------------------------------------------- */

function Demo() {
  return (
    <section id="demo" className={`${SHELL} scroll-mt-6 py-10 lg:py-16`}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 lg:mb-12">
        <div>
          <p className="eyebrow text-muted">See it in action</p>
          <h2 className="mt-3 max-w-[20ch] font-display text-[30px] font-extrabold leading-[1.02] tracking-[-0.035em] lg:text-[46px] 2xl:text-[54px]">
            One month, start to finish.
          </h2>
        </div>
        <p className="max-w-[40ch] text-[14px] font-medium leading-relaxed text-muted lg:text-[15px]">
          This is the real interface, running right here on the page. Step
          through it — the panel is live, so go ahead and use it.
        </p>
      </div>

      <LandingDemo />
    </section>
  );
}

/* --- Features ------------------------------------------------------------- */

const FEATURES = [
  {
    Icon: Upload,
    title: "Import, don't type",
    body: "Drop in the CSV your bank already gives you. Duplicates are fingerprinted away, reversals cancel out, and the balance is checked back against the statement's own opening and closing figures."
  },
  {
    Icon: Inbox,
    title: "A review queue, not an argument",
    body: "Anything unclear waits in Review. Ask \"what was this?\", and the answer stays attached to the transaction. Teach it once and it never asks again."
  },
  {
    Icon: Target,
    title: "Goals that turn into things",
    body: "Save toward something real. When a goal completes it converts into an asset, so what you bought keeps counting toward your net worth."
  },
  {
    Icon: Building2,
    title: "Assets with a memory",
    body: "Purchase price, a full value history, and a nudge when a valuation goes stale. Net worth reflects what things are worth now, not what you paid."
  },
  {
    Icon: Users,
    title: "Per person, or the whole house",
    body: "Tag a spend to one person or leave it with the household. The year view breaks the whole thing down either way."
  },
  {
    Icon: ShieldCheck,
    title: "Read-only by design",
    body: "Housetally never connects to your bank. It reads statements you export yourself — so there's no login to leak and no money it could ever move."
  }
];

function Features() {
  return (
    <section className={`${SHELL} pb-10 lg:pb-16`}>
      <div className="mb-8 lg:mb-12">
        <p className="eyebrow text-muted">What's inside</p>
        <h2 className="mt-3 max-w-[18ch] font-display text-[30px] font-extrabold leading-[1.02] tracking-[-0.035em] lg:text-[46px] 2xl:text-[54px]">
          Built for how a family actually does this.
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {FEATURES.map(({ Icon, title, body }) => (
          <div key={title} className="zone-card shadow-soft">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-[13px] bg-acid">
              <Icon size={20} strokeWidth={2.4} />
            </span>
            <h3 className="mt-5 text-[18px] font-extrabold tracking-[-0.02em] 2xl:text-[20px]">
              {title}
            </h3>
            <p className="mt-2.5 text-[14px] font-medium leading-relaxed text-muted 2xl:text-[15px]">
              {body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --- Tenancy -------------------------------------------------------------- */

const PROMISES = [
  "Your household's figures are isolated from every other household",
  "No bank passwords — you export the statements yourself",
  "Invite the people you share money with, at the role you choose",
  "Add it to your home screen and it works like an app"
];

function Tenancy() {
  return (
    <section className={`${SHELL} pb-10 lg:pb-16`}>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="zone-card shadow-soft lg:p-10 2xl:p-12">
          <p className="eyebrow text-muted">One tally per household</p>
          <h2 className="mt-3 font-display text-[28px] font-extrabold leading-[1.05] tracking-[-0.03em] lg:text-[38px] 2xl:text-[44px]">
            Your family's book is yours alone.
          </h2>
          <p className="mt-5 max-w-[52ch] text-[15px] font-medium leading-relaxed text-muted 2xl:text-[16px]">
            Every figure in Housetally belongs to exactly one household. Sign up
            and you get your own — separate accounts, categories, people and
            history, with nothing pooled and nothing shared by accident.
          </p>
        </div>

        <div className="zone-ink lg:p-10 2xl:p-12">
          <p className="eyebrow text-acid">What we promise</p>
          <ul className="mt-7 space-y-4">
            {PROMISES.map((p) => (
              <li key={p} className="flex items-start gap-3.5">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-acid">
                  <Check size={14} strokeWidth={3} className="text-ink" />
                </span>
                <span className="text-[15px] font-semibold leading-snug text-white/85 2xl:text-[16px]">
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
    <section className={`${SHELL} pb-10 lg:pb-16`}>
      <div className="zone-acid text-center lg:p-16 2xl:p-20">
        <h2 className="mx-auto max-w-[16ch] font-display text-[34px] font-extrabold leading-[0.98] tracking-[-0.04em] lg:text-[58px] 2xl:text-[68px]">
          Close this month properly.
        </h2>
        <p className="mx-auto mt-5 max-w-[46ch] text-[16px] font-semibold lg:text-[18px] 2xl:text-[20px]">
          Set a budget, import one statement, and see where the month actually
          went. It takes about ten minutes.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/login?mode=signup" className="btn justify-center">
            Start your tally <ArrowRight size={17} />
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
    <footer className={`${SHELL} pb-12`}>
      <div className="flex flex-col items-start justify-between gap-5 border-t border-line pt-8 sm:flex-row sm:items-center">
        <Wordmark />
        <p className="text-[13px] font-semibold text-muted">
          Expenses, assets, goals — every rupee tallied.
        </p>
      </div>
    </footer>
  );
}
