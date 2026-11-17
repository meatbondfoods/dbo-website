import { apiError, json } from "@/lib/http";
import { parseBody, requireCustomer } from "@/lib/routeAuth";
import { profileSchema } from "@/lib/auth/schemas";
import { updateProfile } from "@/lib/auth/service";

export async function GET(req: Request) {
  const a = await requireCustomer(req, false); if ("res" in a) return a.res;
  return json({ profile: a.user });
}

// Only name and phone are editable. The customer ID, email and account id can never be changed from here.
export async function PATCH(req: Request) {
  const a = await requireCustomer(req, true); if ("res" in a) return a.res;
  const body = await parseBody(req, profileSchema); if ("res" in body) return body.res;
  return (await updateProfile(a.user, body.data)) ? json({ ok: true, profile: { ...a.user, ...body.data } }) : apiError("Could not update your profile.", 500);
}
