"use client";

import { useState } from "react";
import { ArrowRight, Check, RotateCcw, Sparkles } from "lucide-react";

/**
 * The one genuinely clickable piece of the landing page.
 *
 * It mimics the review queue: a transaction the importer couldn't place, a
 * question against it, and the "remember as rule" behaviour that makes the
 * queue shrink over time. Local state over hard-coded rows — no database, no
 * session — so it can live on a public page.
 */

type Row = {
  id: string;
  desc: string;
  sub: string;
  amount: string;
  answer: string;
  category: string;
};

const ROWS: Row[] = [
  {
    id: "a",
    desc: "Online purchase",
    sub: "14 Sep · Card ending 4471",
    amount: "$63.00",
    answer: "School books for Leo",
    category: "Kids' education"
  },
  {
    id: "b",
    desc: "MAPLE ST 2210",
    sub: "17 Sep · Debit card",
    amount: "$128.40",
    answer: "The dentist",
    category: "Health"
  },
  {
    id: "c",
    desc: "Transfer out",
    sub: "21 Sep · To account ••4102",
    amount: "$200.00",
    answer: "Moved to our own savings",
    category: "Transfer — not spending"
  }
];

export default function TryItPanel() {
  const [done, setDone] = useState<string[]>([]);
  const pending = ROWS.filter((r) => !done.includes(r.id));
  const current = pending[0];

  return (
    <div className="overflow-hidden rounded-[22px] bg-card shadow-soft">
      <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
        </div>
        <div className="flex-1 text-center text-[12px] font-bold text-muted">Trusses — Review</div>
        <div className="w-12 text-right">
          {done.length > 0 && (
            <button
              type="button"
              onClick={() => setDone([])}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-muted transition hover:text-ink"
            >
              <RotateCcw size={11} strokeWidth={2.8} />
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="p-5 lg:p-7">
        <div className="flex items-center justify-between">
          <p className="eyebrow text-muted">
            {pending.length > 0 ? `${pending.length} waiting` : "Nothing waiting"}
          </p>
          {pending.length === 0 && <span className="tag-acid">Queue clear</span>}
        </div>

        {current ? (
          <Card key={current.id} row={current} onAnswer={() => setDone((d) => [...d, current.id])} />
        ) : (
          <div className="mt-4 rounded-[16px] bg-acid p-6 text-center">
            <Check size={26} strokeWidth={3} className="mx-auto" />
            <p className="mt-3 text-[16px] font-extrabold tracking-[-0.02em]">
              That's the month settled.
            </p>
            <p className="mx-auto mt-2 max-w-[34ch] text-[13.5px] font-semibold">
              Three questions, and every line in the statement now has a name on it. Next month
              the same shops file themselves.
            </p>
          </div>
        )}

        <div className="mt-5 flex items-center gap-2">
          {ROWS.map((r) => (
            <span
              key={r.id}
              className={
                "h-1.5 flex-1 rounded-full transition-colors duration-300 " +
                (done.includes(r.id) ? "bg-ink" : "bg-page")
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({ row, onAnswer }: { row: Row; onAnswer: () => void }) {
  const [answered, setAnswered] = useState(false);

  const confirm = () => {
    setAnswered(true);
    // Let the answered state show before the card is replaced.
    setTimeout(onAnswer, 1100);
  };

  return (
    <div className="mt-4 animate-[fadein_.3s_ease] rounded-[16px] bg-page p-4 lg:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-extrabold">{row.desc}</p>
          <p className="mt-0.5 text-[12px] font-semibold text-muted">{row.sub}</p>
        </div>
        <span className="money shrink-0 text-[16px] font-extrabold">{row.amount}</span>
      </div>

      <div className="mt-4 rounded-[12px] bg-card px-3.5 py-3">
        <p className="text-[12px] font-bold text-muted">Asked</p>
        <p className="mt-1 text-[13.5px] font-semibold">What was this one? I can't place it.</p>
      </div>

      {answered ? (
        <div className="mt-2.5 animate-[fadein_.3s_ease] rounded-[12px] bg-acid px-3.5 py-3">
          <p className="text-[12px] font-bold">Answered</p>
          <p className="mt-1 text-[13.5px] font-semibold">
            {row.answer} — filed under {row.category}.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[11.5px] font-bold">
            <Sparkles size={13} strokeWidth={2.6} />
            Remembered — this one files itself from now on.
          </p>
        </div>
      ) : (
        <button type="button" onClick={confirm} className="btn btn-sm mt-3 w-full justify-center">
          {row.answer} <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}
