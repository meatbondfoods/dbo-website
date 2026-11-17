import { notFound } from "next/navigation";
import { getAdminState } from "@/lib/content/store";
import { isContentKey } from "@/lib/content/schema";
import { ContentEditor, type EditorState } from "../../_components/ContentEditor";
import { CONFIG } from "../../_components/configs";

export const dynamic = "force-dynamic";

export default async function ContentPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const cfg = isContentKey(key) ? CONFIG[key] : undefined;
  if (!isContentKey(key) || !cfg) notFound();
  const state = getAdminState(key) as unknown as EditorState;
  return (
    <div className="py-8">
      <h1 className="text-3xl">{cfg.title}</h1>
      <div className="mt-4"><ContentEditor key={`${key}-v${state.version}`} contentKey={key} initial={state} /></div>
    </div>
  );
}
