"use client";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Send } from "lucide-react";

/**
 * Comment input with @mention autocomplete.
 *
 * A plain server-action form gave no feedback while the request was in flight,
 * so a slow round trip read as "nothing happened" and people clicked Send
 * repeatedly — which posted the same note several times. The button is disabled
 * while pending and the field clears on success.
 */
function SendButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-label="Post note"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white transition disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      ) : (
        <Send size={16} strokeWidth={2.2} />
      )}
    </button>
  );
}

export default function CommentComposer({
  entityType,
  entityId,
  members,
  action
}: {
  entityType: string;
  entityId: number;
  /** Household members, for @mention autocomplete. */
  members: Array<{ id: number; name: string }>;
  action: (formData: FormData) => void;
}) {
  const [value, setValue] = useState("");
  const [mentionAt, setMentionAt] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // The partial name being typed after an "@", or null when not mentioning.
  const query =
    mentionAt === null ? null : value.slice(mentionAt + 1).split(/\s/)[0].toLowerCase();
  const matches =
    query === null
      ? []
      : members.filter((m) => m.name.toLowerCase().startsWith(query)).slice(0, 5);

  function onChange(next: string) {
    setValue(next);
    const caret = inputRef.current?.selectionStart ?? next.length;
    // Look back from the caret for an "@" that still belongs to this word.
    const before = next.slice(0, caret);
    const at = before.lastIndexOf("@");
    const valid = at >= 0 && !/\s/.test(before.slice(at + 1)) && (at === 0 || /\s/.test(before[at - 1]));
    setMentionAt(valid ? at : null);
  }

  function pick(name: string) {
    if (mentionAt === null) return;
    const after = value.slice(mentionAt + 1).replace(/^\S*/, "");
    setValue(value.slice(0, mentionAt) + "@" + name + (after.startsWith(" ") ? after : " " + after));
    setMentionAt(null);
    inputRef.current?.focus();
  }

  return (
    <form
      ref={formRef}
      action={(fd) => {
        action(fd);
        setValue("");
        setMentionAt(null);
      }}
      className="relative flex items-center gap-2"
    >
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="entityId" value={entityId} />

      {matches.length > 0 && (
        <ul className="absolute bottom-full left-0 z-20 mb-2 w-56 overflow-hidden rounded-[14px] bg-card shadow-soft">
          {matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => pick(m.name)}
                className="block w-full px-4 py-2.5 text-left text-[14px] font-semibold transition hover:bg-page"
              >
                @{m.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        name="body"
        required
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Add a note… use @name to ask someone"
        className="field min-w-0 flex-1 py-2.5 text-[14px]"
      />
      <SendButton disabled={!value.trim()} />
    </form>
  );
}
