"use client";
import { useState } from "react";
import { PublishBar } from "./PublishBar";
import { useContentActions } from "./useContentActions";
import { Availability } from "@/components/Availability";
import type { Availability as A } from "@/lib/domain/types";

export interface ProductRow { id: string; name: string; category: string; availability: A }
interface Item { productId: string; visible: boolean; featured: boolean; bestSeller: boolean; promoLabel: string; sortOrder: number }
type Items = { items: Item[] };

export function ProductDisplayEditor({ products, draft, published, version }: { products: ProductRow[]; draft: Items; published: Items; version: number }) {
  // One row per ERP product. Missing entries default to visible, unflagged, in ERP order.
  const build = (src: Items): Item[] => products.map((p, i) => src.items.find((x) => x.productId === p.id) ?? { productId: p.id, visible: true, featured: false, bestSeller: false, promoLabel: "", sortOrder: (i + 1) * 10 });
  const [rows, setRows] = useState<Item[]>(() => build(draft));
  const actions = useContentActions("productDisplay");
  const payload = { items: rows };
  // Compare against published after normalising both through the same row builder.
  const unpublished = JSON.stringify(rows) !== JSON.stringify(build(published));
  const patch = (id: string, p: Partial<Item>) => setRows((r) => r.map((x) => (x.productId === id ? { ...x, ...p } : x)));
  const cb = "h-5 w-5 accent-brand";

  return (
    <div>
      <PublishBar unpublished={unpublished} version={version} busy={actions.busy} msg={actions.msg}
        onSave={() => actions.save(payload)} onPreview={() => actions.preview(payload)} onPublish={() => actions.publish(payload)}
        onDiscard={async () => { await actions.discard(); setRows(build(published)); }} />
      <p className="mt-5 max-w-3xl text-sm text-ink-soft">Control how products appear on the website. <strong>Prices and stock come from the ERP and cannot be changed here.</strong> If no product is ticked as Featured (or Best seller), the site chooses automatically.</p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-hairline bg-white shadow-soft">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-hairline bg-mint-light text-xs uppercase tracking-wide text-ink"><tr>
            <th scope="col" className="px-4 py-3">Product</th><th scope="col" className="px-3 py-3">Visible</th><th scope="col" className="px-3 py-3">Featured</th>
            <th scope="col" className="px-3 py-3">Best seller</th><th scope="col" className="px-3 py-3">Promo label</th><th scope="col" className="px-3 py-3">Order</th></tr></thead>
          <tbody className="divide-y divide-hairline">
            {products.map((p) => { const r = rows.find((x) => x.productId === p.id)!; const err = actions.fieldErrors.items?.[0];
              return (
                <tr key={p.id} className={r.visible ? "" : "bg-canvas text-ink-soft"}>
                  <th scope="row" className="px-4 py-3 font-semibold text-deep">{p.name}<span className="block text-xs font-normal text-ink-soft">{p.category} · <Availability value={p.availability} compact /> <span className="sr-only">(from the ERP)</span></span></th>
                  <td className="px-3 py-3"><input type="checkbox" className={cb} aria-label={`${p.name} visible on website`} checked={r.visible} onChange={(e) => patch(p.id, { visible: e.target.checked })} /></td>
                  <td className="px-3 py-3"><input type="checkbox" className={cb} aria-label={`${p.name} featured`} checked={r.featured} onChange={(e) => patch(p.id, { featured: e.target.checked })} /></td>
                  <td className="px-3 py-3"><input type="checkbox" className={cb} aria-label={`${p.name} best seller`} checked={r.bestSeller} onChange={(e) => patch(p.id, { bestSeller: e.target.checked })} /></td>
                  <td className="px-3 py-3"><input className="input w-36" aria-label={`${p.name} promo label`} maxLength={24} placeholder="e.g. New" value={r.promoLabel} onChange={(e) => patch(p.id, { promoLabel: e.target.value })} /></td>
                  <td className="px-3 py-3"><input className="input w-20" type="number" min={0} aria-label={`${p.name} display order`} value={r.sortOrder} onChange={(e) => patch(p.id, { sortOrder: Number(e.target.value) })} />{err && <span className="sr-only">{err}</span>}</td>
                </tr>); })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
