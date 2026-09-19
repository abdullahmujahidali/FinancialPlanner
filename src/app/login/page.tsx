import { login, signup } from "@/actions/auth";
import { currentUserId } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: { e?: string; mode?: string } }) {
  if (await currentUserId()) redirect("/");
  const signupMode = searchParams.mode === "signup";
  return (
    <main className="min-h-screen bg-acid">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12">
        <div className="mb-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo.svg" alt="" width={72} height={72} className="mb-4 border-2 border-line" />
          <h1 className="font-display text-[46px] font-extrabold leading-[0.95] tracking-[-0.04em]">
            Hearth<br />book
          </h1>
          <p className="mt-3 max-w-[30ch] text-[15px] font-semibold">
            Expenses, assets, goals — the family's one book.
          </p>
        </div>

        <div className="border-2 border-line bg-card p-5 shadow-hardlg">
          <h2 className="eyebrow mb-4">{signupMode ? "Create household" : "Sign in"}</h2>

          {searchParams.e && (
            <p className="mb-4 border-2 border-line bg-blush px-3 py-2.5 text-sm font-bold">{searchParams.e}</p>
          )}

          <form action={signupMode ? signup : login} className="space-y-3">
            {signupMode && <input name="name" placeholder="Your name" className="field" required />}
            <input name="email" type="email" placeholder="Email" className="field" required />
            <input name="password" type="password" placeholder="Password" className="field" required minLength={8} />
            {signupMode && <input name="household" placeholder="Household name (e.g. Mujahid family)" className="field" />}
            <button className="btn w-full">{signupMode ? "Create household" : "Sign in"}</button>
          </form>
        </div>

        <a
          href={signupMode ? "/login" : "/login?mode=signup"}
          className="mt-6 block text-center text-sm font-bold underline decoration-2 underline-offset-4"
        >
          {signupMode ? "Already have an account? Sign in" : "New here? Create your household"}
        </a>
      </div>
    </main>
  );
}
