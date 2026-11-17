"use client";
import { useMemo, useState } from "react";
import type { ContentKey } from "@/lib/content/schema";
import { checkTheme, hexToRgb, type ThemeColors } from "@/lib/content/contrast";
import { Field } from "@/components/ui/FormControls";
import { Button } from "@/components/ui/Button";
import { PublishBar } from "./PublishBar";
import { ImageInput } from "./ImageInput";
import { ListField } from "./ListField";
import { CONFIG, type FieldDef } from "./configs";
import { useContentActions } from "./useContentActions";

type Values = Record<string, unknown>;
export interface EditorState {
  draft: Values; published: Values; defaults: Values; version: number; history: { version: number; at: string }[];
}

const toText = (f: FieldDef, v: unknown) =>
  f.type === "lines" ? ((v as string[]) ?? []).join("\n")
  : f.type === "areas" ? ((v as { name: string; distanceKm: number }[]) ?? []).map((a) => `${a.name} | ${a.distanceKm}`).join("\n") : "";

function fromText(f: FieldDef, text: string) {
  const rows = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (f.type === "lines") return rows;
  return rows.flatMap((r) => { const [name, km] = r.split("|").map((x) => x.trim()); const n = Number(km); return name && km !== undefined && km !== "" && Number.isFinite(n) ? [{ name, distanceKm: n }] : []; });
}

export function ContentEditor({ contentKey, initial }: { contentKey: ContentKey; initial: EditorState }) {
  const { fields, intro } = CONFIG[contentKey]!;
  const [values, setValues] = useState<Values>(initial.draft);
  const [texts, setTexts] = useState<Record<string, string>>(() => Object.fromEntries(fields.filter((f) => f.type === "lines" || f.type === "areas").map((f) => [f.name, toText(f, initial.draft[f.name])])));
  const actions = useContentActions(contentKey);
  const unpublished = JSON.stringify(values) !== JSON.stringify(initial.published);

  const theme = contentKey === "theme";
  const contrast = useMemo(() => (theme ? checkTheme(values as unknown as ThemeColors) : []), [theme, values]);
  const failing = contrast.filter((c) => !c.pass);
  const blockReason = failing.length ? `${failing.length} colour pairing${failing.length > 1 ? "s" : ""} below 4.5:1 contrast` : undefined;

  const set = (name: string, v: unknown) => setValues((s) => ({ ...s, [name]: v }));
  const loadInto = (src: Values) => { setValues(src); setTexts(Object.fromEntries(fields.filter((f) => f.type === "lines" || f.type === "areas").map((f) => [f.name, toText(f, src[f.name])]))); };

  // Live preview of the theme using CSS variables scoped to this box only.
  const vars = theme ? Object.fromEntries(["brand", "deep", "leaf", "mint", "gold", "canvas", "ink"].map((k) => [`--c-${k}`, (hexToRgb(String(values[k])) ?? [0, 0, 0]).join(" ")])) : {};
  const radius = { md: "0.375rem", lg: "0.5rem", full: "9999px" }[String(values.buttonRadius) as "md" | "lg" | "full"] ?? "0.5rem";

  return (
    <div>
      <PublishBar unpublished={unpublished} version={initial.version} busy={actions.busy} msg={actions.msg} blockReason={blockReason}
        onSave={() => actions.save(values)} onPreview={() => actions.preview(values)} onPublish={() => actions.publish(values)}
        onDiscard={async () => { await actions.discard(); loadInto(initial.published); }} />
      {intro && <p className="mt-5 max-w-2xl text-sm text-ink-soft">{intro}</p>}

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {fields.map((f) => {
          const err = actions.fieldErrors[f.name]?.[0];
          const wide = f.type === "textarea" || f.type === "lines" || f.type === "areas" || f.type === "image";
          if (f.type === "list") return (
            <div key={f.name} className="md:col-span-2">
              <ListField legend={f.label} def={f.list!} value={(values[f.name] as Record<string, unknown>[]) ?? []} onChange={(v) => set(f.name, v)} />
              {err && <p role="alert" className="mt-2 text-sm font-medium text-danger">Please check the items above: {err}</p>}
            </div>
          );
          if (f.type === "bool") return (
            <label key={f.name} className="flex min-h-[44px] cursor-pointer items-start gap-3 text-sm font-medium md:col-span-2"><input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand" checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} />{f.label}</label>
          );
          return (
            <div key={f.name} className={wide ? "md:col-span-2" : ""}>
              <Field label={f.label} hint={f.hint} error={err}>
                {({ id, describedBy, invalid }) => {
                  const common = { id, "aria-describedby": describedBy, "aria-invalid": invalid || undefined, className: "input" };
                  if (f.type === "image") return <ImageInput id={id} describedBy={describedBy} value={String(values[f.name] ?? "")} onChange={(v) => set(f.name, v)} />;
                  if (f.type === "textarea") return <textarea {...common} rows={3} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} />;
                  if (f.type === "number") return <input {...common} type="number" step="any" value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value === "" ? "" : Number(e.target.value))} />;
                  if (f.type === "color") return (
                    <div className="flex gap-2"><input type="color" aria-label={`${f.label} colour picker`} value={String(values[f.name])} onChange={(e) => set(f.name, e.target.value.toUpperCase())} className="h-11 w-14 cursor-pointer rounded-lg border border-ink-soft bg-white p-1" />
                      <input {...common} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} spellCheck={false} /></div>);
                  if (f.type === "select") return <select {...common} value={String(values[f.name])} onChange={(e) => set(f.name, e.target.value)}>{f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
                  if (f.type === "lines" || f.type === "areas") return <textarea {...common} rows={5} spellCheck={false} value={texts[f.name] ?? ""} onChange={(e) => { setTexts((t) => ({ ...t, [f.name]: e.target.value })); set(f.name, fromText(f, e.target.value)); }} />;
                  return <input {...common} type="text" value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} />;
                }}
              </Field>
            </div>
          );
        })}
      </div>
      <div className="mt-4"><Button variant="ghost" onClick={() => loadInto(initial.defaults)}>Load built-in defaults into the form</Button></div>

      {theme && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="pv" className="card p-5">
            <h2 id="pv" className="text-lg">Live preview</h2>
            <div style={vars as React.CSSProperties} className="mt-4 rounded-xl border border-hairline bg-canvas p-5">
              <h3 className="text-xl">Fresh poultry, delivered with care</h3>
              <p className="mt-1 text-sm text-ink-soft">Secondary text on the page background.</p>
              <div className="mt-4 flex flex-wrap gap-2" style={{ "--r-btn": radius } as React.CSSProperties}>
                <span className="btn-primary">Primary</span><span className="btn-gold">Gold</span><span className="btn-outline">Outline</span>
              </div>
              <div className="mt-4 rounded-lg bg-mint p-3 text-sm text-ink">Mint panel with body text.</div>
              <div className="mt-4 rounded-lg bg-deep p-3 text-sm text-white">Deep green footer area.</div>
            </div>
          </section>
          <section aria-labelledby="ct" className="card p-5">
            <h2 id="ct" className="text-lg">Accessibility check (WCAG AA, 4.5:1)</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {contrast.map((c) => <li key={c.label} className="flex items-center justify-between gap-3"><span>{c.label}</span><span className={`shrink-0 font-bold ${c.pass ? "text-success" : "text-danger"}`}>{c.pass ? "Pass" : "Fail"} · {c.ratio}:1</span></li>)}
            </ul>
          </section>
        </div>
      )}

      {initial.history.length > 0 && (
        <section aria-labelledby="hist" className="mt-10">
          <h2 id="hist" className="text-lg">Published versions</h2>
          <ul className="mt-3 divide-y divide-hairline rounded-xl border border-hairline bg-white text-sm">
            {initial.history.map((h) => (
              <li key={h.version} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>Version {h.version}{h.version === initial.version && <span className="ml-2 rounded-full bg-mint px-2 py-0.5 text-xs font-bold text-deep">Live</span>}<span className="ml-3 text-ink-soft">{new Date(h.at).toLocaleString("en-GB")}</span></span>
                {h.version !== initial.version && <Button variant="outline" disabled={actions.busy} onClick={() => actions.rollback(h.version)}>Roll back to this</Button>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
