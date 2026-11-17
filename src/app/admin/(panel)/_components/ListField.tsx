"use client";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { ImageInput } from "./ImageInput";

export interface ItemField { name: string; label: string; type: "text" | "textarea" | "bool" | "image"; hint?: string }
export interface ListDef { itemFields: ItemField[]; newItem?: () => Record<string, unknown>; max?: number; fixed?: boolean; titleOf: (item: Record<string, unknown>) => string }
type Item = Record<string, unknown>;

/** Editable list of records (banners, menu links, homepage sections) with reorder, add and remove. */
export function ListField({ legend, def, value, onChange }: { legend: string; def: ListDef; value: Item[]; onChange: (v: Item[]) => void }) {
  const uid = useId();
  const move = (i: number, d: number) => { const n = [...value]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  const patch = (i: number, p: Item) => onChange(value.map((x, k) => (k === i ? { ...x, ...p } : x)));
  return (
    <fieldset>
      <legend className="label">{legend}</legend>
      <ul className="space-y-4">
        {value.map((item, i) => (
          <li key={String(item.id ?? i)} className="rounded-xl border border-hairline bg-white p-4 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-deep">{i + 1}. {def.titleOf(item) || "Untitled"}</p>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${def.titleOf(item)} up`}><ArrowUp size={16} aria-hidden /></Button>
                <Button type="button" variant="ghost" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${def.titleOf(item)} down`}><ArrowDown size={16} aria-hidden /></Button>
                {!def.fixed && <Button type="button" variant="ghost" onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label={`Remove ${def.titleOf(item)}`}><Trash2 size={16} aria-hidden /></Button>}
              </div>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {def.itemFields.map((f) => {
                const id = `${uid}-${i}-${f.name}`; const v = item[f.name];
                if (f.type === "bool") return <label key={f.name} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium md:col-span-2"><input type="checkbox" className="h-5 w-5 accent-brand" checked={!!v} onChange={(e) => patch(i, { [f.name]: e.target.checked })} />{f.label}</label>;
                return (
                  <div key={f.name} className={f.type === "textarea" || f.type === "image" ? "md:col-span-2" : ""}>
                    <label htmlFor={id} className="label">{f.label}</label>
                    {f.type === "image" ? <ImageInput id={id} value={String(v ?? "")} onChange={(x) => patch(i, { [f.name]: x })} />
                      : f.type === "textarea" ? <textarea id={id} rows={2} className="input" value={String(v ?? "")} onChange={(e) => patch(i, { [f.name]: e.target.value })} />
                      : <input id={id} className="input" value={String(v ?? "")} onChange={(e) => patch(i, { [f.name]: e.target.value })} />}
                    {f.hint && <p className="mt-1 text-xs text-ink-soft">{f.hint}</p>}
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      {value.length === 0 && <p className="rounded-lg border border-dashed border-ink-soft/40 p-4 text-sm text-ink-soft">Nothing here yet.</p>}
      {!def.fixed && def.newItem && (
        <Button type="button" variant="outline" className="mt-4" disabled={def.max !== undefined && value.length >= def.max} onClick={() => onChange([...value, def.newItem!()])}><Plus size={16} aria-hidden /> Add item</Button>
      )}
    </fieldset>
  );
}
