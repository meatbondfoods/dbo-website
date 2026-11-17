import { requireUser } from "@/lib/auth/page";
import { ProfileForm } from "./ProfileForm";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser("/account/profile");
  return (
    <div>
      <h1 className="text-3xl">Profile</h1>
      <div className="card mt-6 max-w-xl p-6">
        <dl className="mb-6 grid gap-4 border-b border-hairline pb-6 text-sm sm:grid-cols-2">
          <div><dt className="text-ink-soft">Customer ID</dt><dd className="font-mono text-base font-bold text-deep">{user.customerCode}</dd><dd className="mt-1 text-xs text-ink-soft">Permanent. It never changes.</dd></div>
          <div><dt className="text-ink-soft">Email</dt><dd className="break-all font-medium">{user.email}</dd><dd className="mt-1 text-xs text-ink-soft">Verified</dd></div>
        </dl>
        <ProfileForm fullName={user.fullName} phone={user.phone} />
      </div>
    </div>
  );
}
