import "server-only";
import { redirect } from "next/navigation";
import { currentCustomer } from "./service";

/** For account pages: returns the verified customer or redirects to sign-in. Ownership always derives from this. */
export async function requireUser(next: string) {
  const user = await currentCustomer();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}
