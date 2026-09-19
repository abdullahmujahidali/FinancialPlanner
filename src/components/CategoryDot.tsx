const PALETTE = ["#0E6E4C", "#C7A14A", "#7A5C3E", "#41608C", "#A0522D", "#5F7A61", "#8C5A78", "#3D6B6B"];

export default function CategoryDot({ name }: { name: string }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: PALETTE[h % PALETTE.length] }} />;
}
