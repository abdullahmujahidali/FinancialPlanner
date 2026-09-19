import { MessageCircleQuestion, CornerDownRight } from "lucide-react";

/**
 * The question-and-answer exchange on a flagged transaction.
 *
 * Tooba categorises day to day and often can't tell what a bank row was for;
 * she flags it with a question, Abdullah answers in-app. One exchange per
 * transaction — enough to unblock the categorising without becoming a chat.
 */
export default function QuestionThread({
  id,
  question,
  answer,
  askedBy,
  answeredBy,
  answeredAt,
  ask,
  answerAction
}: {
  id: number;
  question: string | null;
  answer: string | null;
  askedBy?: string | null;
  answeredBy?: string | null;
  answeredAt?: Date | string | null;
  ask: (formData: FormData) => void;
  answerAction: (formData: FormData) => void;
}) {
  // Nothing asked yet — offer a compact "ask" affordance.
  if (!question) {
    return (
      <details className="group mt-3">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-[12px] font-bold text-muted transition hover:text-ink">
          <MessageCircleQuestion size={14} strokeWidth={2.2} />
          Ask about this
        </summary>
        <form action={ask} className="mt-2.5 flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <input
            name="question"
            required
            placeholder="e.g. What was this payment for?"
            className="field min-w-0 flex-1 py-2 text-[14px]"
          />
          <button className="btn btn-sm shrink-0">Ask</button>
        </form>
      </details>
    );
  }

  return (
    <div className="mt-3 overflow-hidden rounded-[14px] bg-page">
      <div className="flex gap-2.5 px-4 py-3">
        <MessageCircleQuestion size={15} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" />
        <p className="min-w-0 text-[13px] leading-snug">
          <span className="font-bold">{askedBy || "Question"}:</span>{" "}
          <span className="text-body">{question}</span>
        </p>
      </div>

      {answer ? (
        <div className="flex gap-2.5 border-t border-line bg-acid/25 px-4 py-3">
          <CornerDownRight size={15} strokeWidth={2.2} className="mt-0.5 shrink-0 text-muted" />
          <p className="min-w-0 text-[13px] leading-snug">
            <span className="font-bold">{answeredBy || "Answer"}:</span>{" "}
            <span className="text-body">{answer}</span>
            {answeredAt && (
              <span className="ml-1.5 whitespace-nowrap text-[11px] font-semibold text-muted">
                {new Date(answeredAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </span>
            )}
          </p>
        </div>
      ) : (
        <form action={answerAction} className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          <input type="hidden" name="id" value={id} />
          <input
            name="answer"
            required
            placeholder="Answer this…"
            className="field min-w-0 flex-1 py-2 text-[14px]"
          />
          <button className="btn btn-sm shrink-0">Reply</button>
        </form>
      )}
    </div>
  );
}
