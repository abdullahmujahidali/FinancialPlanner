"use client";
import { useEffect, useRef, useState } from "react";
import { amountHint } from "@/lib/money";

/**
 * A money field that says the amount back in words — "Rs 65 lakh" — at its
 * right edge as you type. The hint sits inside the field, so it fits any form
 * layout without moving anything. Currency comes from the nearest
 * `data-currency` (set by Shell); everything else passes through to <input>.
 */
export default function AmountInput({
  className = "",
  inputClassName = "field num",
  hintPosition = "inside",
  defaultValue,
  ...rest
}: {
  /** Layout classes for the wrapper: flex-1, col-span, and so on. */
  className?: string;
  inputClassName?: string;
  /**
   * "below" for the big hero amount field, where an inline hint would collide;
   * "none" for narrow fixed-width fields in rows that already name the amount.
   */
  hintPosition?: "inside" | "below" | "none";
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue == null ? "" : String(defaultValue));
  const [code, setCode] = useState("PKR");

  useEffect(() => {
    const c = ref.current?.closest<HTMLElement>("[data-currency]")?.dataset.currency;
    if (c) setCode(c);
  }, []);

  const hint = hintPosition === "none" ? "" : amountHint(Number(value), code);
  // Fixed-width fields keep their width; everything else fills its wrapper.
  const width = /(^|\s)w-/.test(inputClassName) ? "" : " w-full";

  return (
    <div className={"relative " + className}>
      <input
        ref={ref}
        type="number"
        inputMode="decimal"
        step="0.01"
        {...rest}
        defaultValue={defaultValue}
        onChange={(e) => {
          setValue(e.target.value);
          rest.onChange?.(e);
        }}
        className={inputClassName + width + (hint && hintPosition === "inside" ? " pr-28" : "")}
      />
      {hintPosition === "below" ? (
        <span aria-live="polite" className="num mt-1 block h-5 text-[14px] font-bold text-ink/55">
          {hint}
        </span>
      ) : hint && (
        <span
          aria-live="polite"
          className="num pointer-events-none absolute right-4 top-1/2 max-w-[45%] -translate-y-1/2 truncate text-[12px] font-bold text-muted"
        >
          {hint}
        </span>
      )}
    </div>
  );
}
