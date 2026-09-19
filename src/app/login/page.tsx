import { login, signup } from "@/actions/auth";
import { currentUserId } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; mode?: string }>;
}) {
  const sp = await searchParams;
  if (await currentUserId()) redirect("/");
  const signupMode = sp.mode === "signup";
  return (
    <main className="min-h-screen bg-acid">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12">
        <div className="mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/logo-mark.png"
            alt=""
            width={104}
            height={72}
            className="mb-5"
          />
          <h1 className="font-display text-[46px] font-extrabold leading-[0.95] tracking-[-0.04em]">
            Trusses
          </h1>
          <p className="mt-4 max-w-[30ch] text-[15px] font-semibold">
            A truss shares the load. So should a household's money.
          </p>
        </div>

        <div className="zone-card">
          <h2 className="eyebrow mb-6">
            {signupMode ? "Create household" : "Sign in"}
          </h2>

          {sp.e && (
            <p className="mb-5 rounded-[14px] bg-blush px-4 py-3 text-sm font-bold">
              {sp.e}
            </p>
          )}

          <form action={signupMode ? signup : login} className="space-y-4">
            {signupMode && (
              <input
                name="name"
                placeholder="Your name"
                className="field"
                required
              />
            )}
            <input
              name="email"
              type="email"
              placeholder="Email"
              className="field"
              required
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              className="field"
              required
              minLength={8}
            />
            {signupMode && (
              <input
                name="household"
                placeholder="Household name"
                className="field"
              />
            )}
            <button className="btn w-full">
              {signupMode ? "Create household" : "Sign in"}
            </button>
          </form>
        </div>

        <a
          href={signupMode ? "/login" : "/login?mode=signup"}
          className="mt-7 block text-center text-sm font-bold underline decoration-2 underline-offset-4"
        >
          {signupMode
            ? "Already have an account? Sign in"
            : "New here? Create your household"}
        </a>
      </div>
    </main>
  );
}
