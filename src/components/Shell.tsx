import Nav from "./Nav";

export default function Shell({ title, action, children }: {
  title: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 pb-32 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="mb-6 flex items-baseline justify-between gap-3">
        <h1 className="min-w-0 truncate font-display text-[24px] font-semibold tracking-tight">{title}</h1>
        {action}
      </header>
      {children}
      <Nav />
    </div>
  );
}
