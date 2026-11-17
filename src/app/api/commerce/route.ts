import { getContent } from "@/lib/content/store";
import { json } from "@/lib/http";

// Public, PUBLISHED delivery settings only (never a draft). Used by cart and checkout to show the delivery rule.
export async function GET() {
  return json(getContent("commerce"));
}
