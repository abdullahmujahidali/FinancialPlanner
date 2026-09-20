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
      <Incentive />
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
      <div className="zone-acid overflow-hidden px-5 py-10 text-center sm:px-8 sm:py-12 lg:p-14 2xl:p-16">
        <p className="eyebrow mb-4 text-[10px] sm:text-[11px] lg:mb-5">For households where two people share the money</p>
        <h1 className="mx-auto max-w-[15ch] font-display text-[32px] font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-[48px] sm:leading-[0.92] sm:tracking-[-0.045em] lg:text-[76px] 2xl:text-[88px]">
          Someone in your house already does the money.
        </h1>
        <p className="mx-auto mt-5 max-w-[38ch] text-[15px] font-semibold leading-relaxed sm:max-w-[56ch] sm:text-[16px] lg:mt-7 lg:text-[19px]">
          They chase the receipts, remember what the odd card charge was, and quietly keep the
          whole thing straight. {BRAND.name} gives that person a proper book to work in — and
          pays them a cut of what they save.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-2.5 sm:flex-row sm:gap-3 lg:mt-10">
          <Link href="/login?mode=signup" className="btn justify-center">
            Start your book <ArrowRight size={17} />
          </Link>
          <Link href="#try" className="btn-quiet justify-center">
            Try the review queue
          </Link>
        </div>
        <p className="mt-5 text-[12.5px] font-semibold opacity-70 sm:text-[13px]">
          Free. No card. We never ask for your bank login.
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
    ["58", "rows in the statement we tested this on. All 58 imported, balance matched to the rupee."],
    ["90", "days before it starts asking you to revalue an asset."],
    ["2", "people is all this is built for. Three or four works. Fifty does not."]
  ];
  return (
    <section className={`${SHELL} pb-4`}>
      <div className="zone-ink grid gap-7 sm:grid-cols-3 lg:p-10 2xl:p-12">
        {stats.map(([figure, caption]) => (
          <div key={caption}>
            <p className="money-xl text-[30px] text-acid sm:text-[36px] lg:text-[44px] 2xl:text-[52px]">{figure}</p>
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
          <p className="eyebrow text-muted">The part nobody else has</p>
          <h2 className="mt-3 max-w-[18ch] font-display text-[25px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[30px] sm:leading-[1.02] sm:tracking-[-0.035em] lg:text-[46px] 2xl:text-[52px]">
            &ldquo;What was this one?&rdquo;
          </h2>
          <p className="mt-5 max-w-[48ch] text-[15px] font-medium leading-relaxed text-muted lg:text-[16px]">
            Whoever is doing the categorising hits a row they can&rsquo;t place. A card charge,
            no merchant name, three weeks ago. In a spreadsheet that becomes a text message,
            then a conversation at dinner, then a guess.
          </p>
          <p className="mt-4 max-w-[48ch] text-[15px] font-medium leading-relaxed text-muted lg:text-[16px]">
            Here it becomes a question attached to the transaction. The other person answers
            when they get to it. The answer stays on that row permanently, so in eleven months
            when you both wonder what it was, the row already says.
          </p>
          <p className="mt-4 max-w-[48ch] text-[15px] font-medium leading-relaxed text-muted lg:text-[16px]">
            Answer the three below. Tick &ldquo;remember as a rule&rdquo; and that shop never
            gets asked about again.
          </p>
        </div>
        <TryItPanel />
      </div>
    </section>
  );
}

/* --- The incentive -------------------------------------------------------- */

function Incentive() {
  return (
    <section className={`${SHELL} pb-10 lg:pb-16`}>
      <div className="zone-ink lg:p-12 2xl:p-16">
        <div className="grid gap-9 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            <p className="eyebrow text-acid">Pay the person who does it</p>
            <h2 className="mt-3 max-w-[20ch] font-display text-[26px] font-extrabold leading-[1.04] tracking-[-0.03em] text-white sm:text-[32px] lg:text-[44px] 2xl:text-[50px]">
              This is real work. It should be paid like it.
            </h2>
            <p className="mt-6 max-w-[54ch] text-[15px] font-medium leading-relaxed text-white/70 lg:text-[16px]">
              Household admin is usually invisible labour. One person does hours of it every
              month and the thanks is that nobody notices when it&rsquo;s done well.
            </p>
            <p className="mt-4 max-w-[54ch] text-[15px] font-medium leading-relaxed text-white/70 lg:text-[16px]">
              So {BRAND.name} has a number built into it. Set a monthly budget and a
              percentage. Whatever comes in under budget is the saving, and that percentage of
              it belongs to whoever keeps the book. It shows up on the dashboard next to the
              savings figure, calculated, every month, without anyone having to ask.
            </p>
            <p className="mt-4 max-w-[54ch] text-[15px] font-medium leading-relaxed text-white/70 lg:text-[16px]">
              Ten percent is the default. It is your household, so make it whatever you both
              think is fair.
            </p>
          </div>

          {/* The arithmetic, as the app actually shows it. */}
          <div className="self-center rounded-[18px] bg-ink2 p-6 lg:p-8">
            <p className="eyebrow text-white/40">A month, worked through</p>
            <dl className="mt-6 space-y-4">
              <Line label="Budget" value="6,400" />
              <Line label="Actually spent" value="4,628" />
              <div className="h-px bg-white/10" />
              <Line label="Saved" value="1,772" accent />
              <Line label="Their 10%" value="177" accent />
            </dl>
            <p className="mt-6 text-[13px] font-semibold leading-relaxed text-white/45">
              Reimbursed bills and transfers between your own accounts are left out of the
              spend figure, so the saving is not inflated by money that was never gone.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Line({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={"text-[14px] font-semibold " + (accent ? "text-white" : "text-white/55")}>
        {label}
      </dt>
      <dd className={"money text-[22px] font-extrabold " + (accent ? "text-acid" : "text-white")}>
        {value}
      </dd>
    </div>
  );
}

/* --- Features -------------------------------------------------------------- */

const FEATURES = [
  {
    Icon: Upload,
    title: "Import the statement",
    body: "Export the CSV your bank already offers and drop it in. Rows you have seen before are fingerprinted and skipped, so importing the same file twice does nothing. Reversal pairs cancel each other out. At the end it checks its own total against the opening and closing balance printed on your statement, and tells you if they disagree."
  },
  {
    Icon: Inbox,
    title: "Rules you taught it",
    body: "Answer a question once, tick remember, and that merchant files itself from then on. Most households get to a handful of questions a month within two statements."
  },
  {
    Icon: Users,
    title: "Whose spending was it",
    body: "Tag a row to one person, or leave it with the household where it belongs. Useful when the kids' costs start mattering and nobody can remember what the year actually looked like."
  },
  {
    Icon: Target,
    title: "Goals become assets",
    body: "Save up for the car. When the goal completes it turns into an asset with the purchase price on it, so the thing you bought carries on counting toward net worth instead of vanishing from the books the day you paid for it."
  },
  {
    Icon: Building2,
    title: "What things are worth now",
    body: "Assets keep a value history, not just what you paid. After 90 days without a fresh valuation the dashboard says so, because a net worth built on three-year-old numbers is worse than no number."
  },
  {
    Icon: ShieldCheck,
    title: "We never see your bank",
    body: "There is no bank connection here. You export the file, you upload it. That is a slightly slower Sunday and a permanently smaller problem: no credentials of yours exist for anyone to lose, and nothing in this app has the power to move a rupee."
  }
];

function Features() {
  return (
    <section className={`${SHELL} pb-10 lg:pb-16`}>
      <div className="mb-8 lg:mb-12">
        <p className="eyebrow text-muted">Table stakes, done properly</p>
        <h2 className="mt-3 max-w-[18ch] font-display text-[25px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[30px] sm:leading-[1.02] sm:tracking-[-0.035em] lg:text-[46px] 2xl:text-[54px]">
          The rest of it.
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
  "Every query is scoped to your household before it returns anything",
  "No bank credentials, because there is no bank connection",
  "Invite the people you share money with, as owner or member",
  "Add to Home Screen and it behaves like an installed app"
];

function Tenancy() {
  return (
    <section className={`${SHELL} pb-10 lg:pb-16`}>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="zone-card shadow-soft lg:p-10 2xl:p-12">
          <p className="eyebrow text-muted">One book per household</p>
          <h2 className="mt-3 font-display text-[24px] font-extrabold leading-[1.06] tracking-[-0.03em] sm:text-[28px] sm:leading-[1.05] lg:text-[38px] 2xl:text-[44px]">
            One book, one household.
          </h2>
          <p className="mt-5 max-w-[52ch] text-[15px] font-medium leading-relaxed text-muted 2xl:text-[16px]">
            Sign up and you get your own book. Your accounts, your categories, the people in
            your house, your history. Another family signing up tomorrow gets theirs, and the
            two never touch — every query in this app is filtered by household before it
            returns a single row.
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
      <div className="zone-acid px-5 py-10 text-center sm:px-8 sm:py-12 lg:p-16 2xl:p-20">
        <h2 className="mx-auto max-w-[16ch] font-display text-[28px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-[34px] sm:leading-[0.98] sm:tracking-[-0.04em] lg:text-[58px] 2xl:text-[68px]">
          Start with one statement.
        </h2>
        <p className="mx-auto mt-5 max-w-[46ch] text-[16px] font-semibold lg:text-[18px] 2xl:text-[20px]">
          Set a budget, import last month, and answer the handful of questions it comes back
          with. You will know where the month went before the tea goes cold.
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
