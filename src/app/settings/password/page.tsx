import SettingsPage from "@/components/SettingsPage";
import SubmitButton from "@/components/SubmitButton";
import { requireContext } from "@/lib/session";
import { changePassword } from "@/actions/auth";
import ErrorToast from "@/components/ErrorToast";

export const dynamic = "force-dynamic";

export default async function PasswordSettings({
  searchParams
}: {
  searchParams: Promise<{ e?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const { user } = await requireContext();

  return (
    <SettingsPage
      title="Password"
      description={`Change the password for ${user.email}. Everyone in the household has their own.`}
    >
      {sp.ok && (
        <p className="mb-4 rounded-[18px] bg-acid px-5 py-4 text-[14px] font-bold">Password changed.</p>
      )}
      <ErrorToast message={sp.e} />
      <form action={changePassword} className="rounded-[22px] bg-card p-6 lg:p-8">
        <div className="flex flex-col gap-5">
          {[
            ["current", "Current password", "current-password"],
            ["next", "New password", "new-password"],
            ["confirm", "New password again", "new-password"]
          ].map(([name, label, auto]) => (
            <label key={name} className="block">
              <span className="eyebrow text-muted">{label}</span>
              <input name={name} type="password" autoComplete={auto} required className="field mt-2" />
            </label>
          ))}
          <p className="text-[13px] text-muted">At least 8 characters.</p>
          <SubmitButton pendingLabel="Saving…">Change password</SubmitButton>
        </div>
      </form>
    </SettingsPage>
  );
}
