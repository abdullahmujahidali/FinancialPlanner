import { login, signup } from "@/actions/auth";
import { currentUserId } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: { e?: string; mode?: string } }) {
  if (await currentUserId()) redirect("/");
  const signupMode = searchParams.mode === "signup";
  return (
    <main className="flex min-h-screen flex-col bg-forest px-6 pb-10 pt-[max(4rem,env(safe-area-inset-top))] text-cream">
      <div className="mx-auto w-full max-w-sm flex-1">
        <p className="font-display text-[40px] font-semibold leading-tight tracking-tight">Hearthbook</p>
        <p className="mt-2 text-[15px] text-cream/60">Expenses, assets, goals — the family's one book.</p>

        <div className="mt-10 rounded-3xl bg-card p-5 text-ink shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
          {searchParams.e && <p className="mb-4 rounded-xl bg-oversoft px-3 py-2.5 text-sm text-over">{searchParams.e}</p>}
          <form action={signupMode ? signup : login} className="space-y-3">
            {signupMode && <input name="name" placeholder="Your name" className="field" required />}
            <input name="email" type="email" placeholder="Email" className="field" required />
            <input name="password" type="password" placeholder="Password" className="field" required minLength={8} />
            {signupMode && <input name="household" placeholder="Household name (e.g. Mujahid family)" className="field" />}
            <button className="btn w-full">{signupMode ? "Create household" : "Sign in"}</button>
          </form>
        </div>
        <a href={signupMode ? "/login" : "/login?mode=signup"} className="mt-6 block text-center text-sm text-cream/70 underline underline-offset-4">
          {signupMode ? "Already have an account? Sign in" : "New here? Create your household"}
        </a>
      </div>
    </main>
  );
}
