import { login, signup } from "@/actions/auth";
import { currentUserId } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: { e?: string; mode?: string } }) {
  if (await currentUserId()) redirect("/");
  const signupMode = searchParams.mode === "signup";
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <div className="mb-2 inline-block rounded bg-brand px-2.5 py-1 text-lg font-semibold text-white">Khata</div>
        <p className="text-muted">The family ledger. Expenses, assets, goals — one book.</p>
      </div>
      {searchParams.e && <p className="mb-4 rounded bg-oversoft px-3 py-2 text-sm text-over">{searchParams.e}</p>}
      <form action={signupMode ? signup : login} className="space-y-3">
        {signupMode && <input name="name" placeholder="Your name" className="field" required />}
        <input name="email" type="email" placeholder="Email" className="field" required />
        <input name="password" type="password" placeholder="Password" className="field" required minLength={8} />
        {signupMode && <input name="household" placeholder="Household name (e.g. Mujahid family)" className="field" />}
        <button className="btn w-full">{signupMode ? "Create household" : "Sign in"}</button>
      </form>
      <a href={signupMode ? "/login" : "/login?mode=signup"} className="mt-4 text-center text-sm text-brand">
        {signupMode ? "Already have an account? Sign in" : "New here? Create your household"}
      </a>
    </main>
  );
}
