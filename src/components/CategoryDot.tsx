/** Square swatch with a hard border — same palette as the donut. */
const PALETTE = ["#E2FB4F", "#0A0A0A", "#E98D7C", "#C9E23F", "#6B6B6B", "#FFFFFF"];

export default function CategoryDot({ name }: { name: string }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 border-2 border-line"
      style={{ background: PALETTE[h % PALETTE.length] }}
    />
  );
}
