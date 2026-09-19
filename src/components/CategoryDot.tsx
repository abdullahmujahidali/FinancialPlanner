import { DONUT_COLORS } from "@/lib/palette";

/**
 * Legend swatch. Takes the slice's RANK so its colour matches the donut
 * segment exactly — without an index it falls back to hashing the name, which
 * is only used where there is no chart to agree with.
 */
export default function CategoryDot({ name, index }: { name: string; index?: number }) {
  let i = index;
  if (i === undefined) {
    let h = 0;
    for (let c = 0; c < name.length; c++) h = (h * 31 + name.charCodeAt(c)) >>> 0;
    i = h;
  }
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
    />
  );
}
