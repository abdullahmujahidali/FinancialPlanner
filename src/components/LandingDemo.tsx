"use client";

import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Inbox,
  PieChart,
  Check,
  ArrowRight,
  Sparkles
} from "lucide-react";

/**
 * The landing page's interactive demo: a fake Housetally window whose contents
 * change as you step through a month. Everything here is local state over
 * hard-coded rows — it touches no database and no session, so it can live on
 * the public page.
 *
 * Steps auto-advance until the visitor clicks a step themselves, at which point
 * we stop driving it and let them explore. That gives an unattended page some
 * motion without hijacking anyone who's actually using it.
 */

type StepId = "import" | "review" | "close";

const STEPS: Array<{
  id: StepId;
  n: string;
  label: string;
  blurb: string;
  Icon: typeof Upload;
}> = [
  {
    id: "import",
    n: "01",
    label: "Import the statement",
    blurb:
      "Drop in the CSV your bank already gives you. Duplicates and reversals are removed before anything is counted.",
    Icon: Upload
  },
  {
    id: "review",
    n: "02",
    label: "Agree on what's unclear",
    blurb:
      "Only what it couldn't place waits here. Answer once, and it files the same thing that way forever.",
    Icon: Inbox
  },
  {
    id: "close",
    n: "03",
    label: "Close the month",
    blurb:
      "Spending against budget, what was saved, and each person's share — settled and shared with the family.",
    Icon: PieChart
  }
];

export default function LandingDemo() {
  const [step, setStep] = useState<StepId>("import");
  const [touched, setTouched] = useState(false);
  const [visible, setVisible] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Only animate once the demo is actually on screen — no point cycling a
  // section nobody has scrolled to yet.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (touched || !visible) return;
    const id = setInterval(() => {
      setStep((s) => {
        const i = STEPS.findIndex((x) => x.id === s);
        return STEPS[(i + 1) % STEPS.length].id;
      });
    }, 3800);
    return () => clearInterval(id);
  }, [touched, visible]);

  const pick = (id: StepId) => {
    setTouched(true);
    setStep(id);
  };

  return (
    <div ref={root} className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10">
      {/* Step rail */}
      <div className="flex flex-col gap-3">
        {STEPS.map(({ id, n, label, blurb, Icon }) => {
          const on = id === step;
          return (
            <button
              key={id}
              type="button"
              onClick={() => pick(id)}
              aria-current={on}
              className={
                "group rounded-[18px] p-5 text-left transition-all duration-300 " +
                (on
                  ? "bg-ink text-white shadow-soft"
                  : "bg-card text-ink hover:bg-white")
              }
            >
              <div className="flex items-center gap-3">
                <span
                  className={
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] transition " +
                    (on ? "bg-acid text-ink" : "bg-page text-ink")
                  }
                >
                  <Icon size={17} strokeWidth={2.4} />
                </span>
                <span
                  className={
                    "money text-[12px] font-extrabold " +
                    (on ? "text-acid" : "text-muted")
                  }
                >
                  {n}
                </span>
                <span className="text-[16px] font-extrabold tracking-[-0.02em]">
                  {label}
                </span>
              </div>
              <p
                className={
                  "mt-3 text-[13.5px] font-medium leading-relaxed transition-all " +
                  (on ? "text-white/70" : "text-muted")
                }
              >
                {blurb}
              </p>
            </button>
          );
        })}

        <p className="mt-1 px-1 text-[12.5px] font-semibold text-muted">
          {touched ? "Click a step to explore." : "Playing — click any step to take over."}
        </p>
      </div>

      {/* The fake app window */}
      <div className="overflow-hidden rounded-[22px] bg-card shadow-soft">
        <WindowChrome step={step} />
        <div className="p-5 lg:p-7">
          {step === "import" && <ImportPane />}
          {step === "review" && <ReviewPane />}
          {step === "close" && <ClosePane />}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const TITLES: Record<StepId, string> = {
  import: "Import",
  review: "Review",
  close: "This month"
};

function WindowChrome({ step }: { step: StepId }) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
      <div className="flex gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
      </div>
      <div className="flex-1 truncate text-center text-[12px] font-bold text-muted">
        Housetally — {TITLES[step]}
      </div>
      <div className="w-12" />
    </div>
  );
}

/* --- Pane 1: import ------------------------------------------------------- */

const IMPORTED: Array<[string, string, string]> = [
  ["Supermarket", "Groceries", "18,240"],
  ["Fuel station", "Transport", "9,100"],
  ["Electricity bill", "Utilities", "9,860"],
  ["Salary", "Income", "412,000"],
  ["ATM withdrawal", "Transfer", "25,000"]
];

function ImportPane() {
  return (
    <div className="animate-[fadein_.35s_ease]">
      <div className="flex items-center justify-between gap-3 rounded-[14px] bg-acid px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <Check size={16} strokeWidth={3} />
          <span className="text-[13.5px] font-extrabold">
            statement.csv — 58 rows read
          </span>
        </div>
        <span className="tag bg-ink text-white">Balance checks out</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <Stat figure="54" caption="filed automatically" />
        <Stat figure="3" caption="duplicates skipped" />
        <Stat figure="1" caption="needs a person" />
      </div>

      <div className="mt-5">
        {IMPORTED.map(([desc, cat, amt]) => (
          <div
            key={desc}
            className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0"
          >
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-bold">{desc}</p>
              <p className="text-[11.5px] font-semibold text-muted">{cat}</p>
            </div>
            <span className="money shrink-0 text-[13.5px] font-bold">₨ {amt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ figure, caption }: { figure: string; caption: string }) {
  return (
    <div className="rounded-[14px] bg-page px-3.5 py-3">
      <p className="money text-[20px] font-extrabold leading-none">{figure}</p>
      <p className="mt-1.5 text-[11px] font-semibold leading-tight text-muted">
        {caption}
      </p>
    </div>
  );
}

/* --- Pane 2: review ------------------------------------------------------- */

function ReviewPane() {
  const [answered, setAnswered] = useState(false);

  // Reset when the visitor steps away and comes back, so the demo always
  // starts from the unanswered state.
  useEffect(() => () => setAnswered(false), []);

  return (
    <div className="animate-[fadein_.35s_ease]">
      <div className="flex items-center justify-between">
        <p className="eyebrow text-muted">1 waiting</p>
        {answered && <span className="tag-acid">Queue clear</span>}
      </div>

      <div className="mt-4 rounded-[16px] bg-page p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[15px] font-extrabold">Online purchase</p>
            <p className="mt-0.5 text-[12px] font-semibold text-muted">
              14 Sep · Card ending 4471
            </p>
          </div>
          <span className="money text-[16px] font-extrabold">₨ 6,300</span>
        </div>

        <div className="mt-4 rounded-[12px] bg-card px-3.5 py-3">
          <p className="text-[12.5px] font-bold text-muted">Asked</p>
          <p className="mt-1 text-[13.5px] font-semibold">
            What was this one? I can't place it.
          </p>
        </div>

        {answered ? (
          <div className="mt-2.5 rounded-[12px] bg-acid px-3.5 py-3">
            <p className="text-[12.5px] font-bold">Answered</p>
            <p className="mt-1 text-[13.5px] font-semibold">
              School books for Miral — filed under Education.
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[11.5px] font-bold">
              <Sparkles size={13} strokeWidth={2.6} />
              Remembered — this shop files itself from now on.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAnswered(true)}
            className="btn btn-sm mt-3 w-full justify-center"
          >
            Answer &amp; remember as rule <ArrowRight size={14} />
          </button>
        )}
      </div>

      <p className="mt-4 text-[12.5px] font-medium leading-relaxed text-muted">
        Every question and answer stays attached to the transaction, so next
        year you can still see what a line actually was.
      </p>
    </div>
  );
}

/* --- Pane 3: close -------------------------------------------------------- */

const CATEGORIES: Array<[string, number, string]> = [
  ["Groceries", 78, "72,400"],
  ["Utilities", 54, "49,900"],
  ["Transport", 41, "38,100"],
  ["Education", 33, "30,600"],
  ["Health", 21, "19,200"]
];

function ClosePane() {
  return (
    <div className="animate-[fadein_.35s_ease]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-muted">Spent</p>
          <p className="money-xl mt-1.5 text-[32px]">₨ 268,400</p>
        </div>
        <div className="rounded-[14px] bg-acid px-4 py-2.5 text-right">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em]">Saved</p>
          <p className="money text-[19px] font-extrabold">₨ 81,600</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {CATEGORIES.map(([name, pct, amt]) => (
          <div key={name}>
            <div className="flex items-baseline justify-between text-[12.5px] font-bold">
              <span>{name}</span>
              <span className="money text-muted">₨ {amt}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-page">
              <div
                className="h-full rounded-full bg-ink transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2.5">
        <Stat figure="₨ 350k" caption="budget set" />
        <Stat figure="77%" caption="of budget used" />
        <Stat figure="4" caption="people tracked" />
      </div>
    </div>
  );
}
