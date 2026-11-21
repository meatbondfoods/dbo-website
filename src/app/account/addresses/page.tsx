import { requireUser } from "@/lib/auth/page";
import { listAddresses } from "@/lib/auth/service";
import { AddressManager } from "./AddressManager";

export const metadata = { title: "Addresses" };
export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  return (
    <div>
      <h1 className="text-3xl">Delivery addresses</h1>
      <p className="mt-1 text-sm text-ink-soft">Save up to 10 delivery addresses with live GPS location. Free delivery within 7 km of Chandgaon, Chattagram.</p>
      <AddressManager initial={await listAddresses(user)} defaultName={user.fullName} defaultPhone={user.phone} />
    </div>
  );
}
