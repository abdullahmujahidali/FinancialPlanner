import Link from "next/link";
import type { Metadata } from "next";
import { currentUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import DeviceShowcase from "@/components/DeviceShowcase";
import TryItPanel from "@/components/TryItPanel";
import { BRAND } from "@/lib/brand";
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
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.blurb,
  openGraph: {
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.blurb,
    type: "website"
  }
};

/**
 * Public marketing page. Lives outside the auth wall (see middleware) and
 * deliberately does not import Shell — no sidebar, no session, no DB.
 *
 * Built from the app's own design system (acid / ink / blush zones, 22px
 * geometry, oversized display figures) so signing up feels continuous with
 * what was just on screen. Every device image is a genuine screenshot of the
 * running product against a seeded demo household, never a mockup.
 *
 * Copy is currency-neutral and names no bank: this has to sell to any family.
 */
export default async function Welcome() {
  // A logged-in family lands on their ledger, not the sales pitch.
  if (await currentUserId()) redirect("/");

  return (
    <main className="min-h-screen bg-page">
      <Header />
      <Hero />
      <Showcase />
      <ProofStrip />
      <TryIt />
      <Features />
      <Tenancy />
      <Closer />
      <Footer />
    </main>
  );
}

/* -------------------------------------------------------------------------- */

/** One shared gutter so every band lines up, edge to edge on big monitors. */
const SHELL = "mx-auto w-full max-w-[1800px] px-4 sm:px-6 lg:px-10 2xl:px-14";

function Wordmark({ size = 34 }: { size?: number }) {
  return (
    <Link href="/welcome" className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/logo-mark.png"
        alt=""
        width={Math.round(size * 1.45)}
        height={size}
        className="shrink-0"
      />
      <span className="font-display text-[19px] font-extrabold tracking-[-0.03em] text-ink">
        {BRAND.name}
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
          Start your book
        </Link>
      </nav>
    </header>
  );
}

/* --- Hero ----------------------------------------------------------------- */

function Hero() {
  return (
    <section className={`${SHELL} pb-4`}>
      <div className="zone-acid overflow-hidden text-center lg:p-14 2xl:p-16">
        <p className="eyebrow mb-5">The shared family ledger</p>
        <h1 className="mx-auto max-w-[14ch] font-display text-[42px] font-extrabold leading-[0.92] tracking-[-0.045em] sm:text-[62px] lg:text-[80px] 2xl:text-[92px]">
          Every expense, carried together.
        </h1>
        <p className="mx-auto mt-6 max-w-[54ch] text-[16px] font-semibold leading-relaxed lg:mt-7 lg:text-[19px]">
          {BRAND.name} replaces the household spreadsheet. Import your bank statement, agree on
          what each line actually was, and watch the month's savings add up — together, not in
          one person's head.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:mt-10">
          <Link href="/login?mode=signup" className="btn justify-center">
            Start your book <ArrowRight size={17} />
          </Link>
          <Link href="#try" className="btn-quiet justify-center">
            Try it right here
          </Link>
        </div>
        <p className="mt-5 text-[13px] font-semibold opacity-70">
          Free for your family. No card, and never your bank password.
        </p>
      </div>
    </section>
  );
}

/* --- Device showcase ------------------------------------------------------ */

function Showcase() {
  return (
    <section className={`${SHELL} -mt-2 pb-10 lg:pb-16`}>
      <DeviceShowcase />
    </section>
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
    <section className={`${SHELL} pb-4`}>
      <div className="zone-ink grid gap-7 sm:grid-cols-3 lg:p-10 2xl:p-12">
        {stats.map(([figure, caption]) => (
          <div key={caption}>
            <p className="money-xl text-[36px] text-acid lg:text-[44px] 2xl:text-[52px]">{figure}</p>
            <p className="mt-2.5 max-w-[26ch] text-[13px] font-semibold leading-snug text-white/70 2xl:text-[14px]">
              {caption}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --- The clickable bit ---------------------------------------------------- */

function TryIt() {
  return (
    <section id="try" className={`${SHELL} scroll-mt-6 py-10 lg:py-16`}>
      <div className="grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
        <div>
          <p className="eyebrow text-muted">Try it — this one really works</p>
          <h2 className="mt-3 max-w-[16ch] font-display text-[30px] font-extrabold leading-[1.02] tracking-[-0.035em] lg:text-[46px] 2xl:text-[52px]">
            The review queue, in your hands.
          </h2>
          <p className="mt-5 max-w-[48ch] text-[15px] font-medium leading-relaxed text-muted lg:text-[16px]">
            An import never guesses at what it doesn't know. Whatever it can't place waits in
            Review as a plain question, and the answer stays attached to the transaction — so
            next year you can still see what a line actually was.
          </p>
          <p className="mt-4 max-w-[48ch] text-[15px] font-medium leading-relaxed text-muted lg:text-[16px]">
            Answer the three on the right and watch the queue empty. Teach it once, and the same
            shop files itself every month after.
          </p>
        </div>
        <TryItPanel />
      </div>
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
    body: `${BRAND.name} never connects to your bank. It reads statements you export yourself — so there's no login to leak and no money it could ever move.`
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
          <p className="eyebrow text-muted">One book per household</p>
          <h2 className="mt-3 font-display text-[28px] font-extrabold leading-[1.05] tracking-[-0.03em] lg:text-[38px] 2xl:text-[44px]">
            A truss shares the load.
          </h2>
          <p className="mt-5 max-w-[52ch] text-[15px] font-medium leading-relaxed text-muted 2xl:text-[16px]">
            No single beam carries a roof — the frame spreads the weight across every member.
            Household money works the same way, and so does {BRAND.name}: every figure belongs
            to exactly one household, with its own accounts, categories, people and history,
            and nothing pooled or shared by accident.
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
          Set a budget, import one statement, and see where the month actually went. It takes
          about ten minutes.
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
    <footer className={`${SHELL} pb-12`}>
      <div className="flex flex-col items-start justify-between gap-5 border-t border-line pt-8 sm:flex-row sm:items-center">
        <Wordmark />
        <p className="text-[13px] font-semibold text-muted">{BRAND.metaphor}</p>
      </div>
    </footer>
  );
}
