import Nav from "./Nav";

export default function Shell({ title, action, children }: {
  title: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 pb-28 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-5 flex items-baseline justify-between">
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        {action}
      </header>
      {children}
      <Nav />
    </div>
  );
}
