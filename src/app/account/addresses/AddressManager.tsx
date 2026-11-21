"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Plus, Trash2, Loader2, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import type { AddressDto } from "@/lib/auth/types";
import { TextArea, TextInput } from "@/components/ui/FormControls";
import { Button } from "@/components/ui/Button";

interface FormState {
  fullName: string;
  phone: string;
  line1: string;
  area: string;
  city: string;
  postalCode: string;
  instructions: string;
  isDefault: boolean;
}

const CHATTOGRAM_AREAS = [
  "Chandgaon",
  "Bahaddarhat",
  "Muradpur",
  "Panchlaish",
  "Chawkbazar",
  "Sholashahar",
  "Nasirabad",
  "GEC Circle",
  "Bakalia",
  "Mehedibag",
  "Oxygen",
  "Bayezid",
  "Khulshi",
  "Lalkhan Bazar",
  "Kotwali",
  "New Market",
  "Agrabad",
  "Pahartali",
  "Halishahar",
  "Patenga",
];

export function AddressManager({
  initial,
  defaultName,
  defaultPhone,
}: {
  initial: AddressDto[];
  defaultName: string;
  defaultPhone: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<AddressDto | "new" | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [formDraft, setFormDraft] = useState<FormState>({
    fullName: defaultName || "",
    phone: defaultPhone || "",
    line1: "",
    area: "",
    city: "Chattagram",
    postalCode: "",
    instructions: "",
    isDefault: false,
  });
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<{
    type: "success" | "warning" | "error";
    message: string;
    mapsUrl?: string;
    isDeliverable?: boolean;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [fe, setFe] = useState<Record<string, string[]>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function call(url: string, method: string, body?: unknown) {
    const r = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { ok: r.ok, data: await r.json().catch(() => ({})) };
  }

  function handleStartNew() {
    setFormDraft({
      fullName: defaultName || "",
      phone: defaultPhone || "",
      line1: "",
      area: "",
      city: "Chattagram",
      postalCode: "",
      instructions: "",
      isDefault: initial.length === 0,
    });
    setEditing("new");
    setMsg("");
    setLocationStatus(null);
    setFormKey((k) => k + 1);
  }

  function handleStartEdit(x: AddressDto) {
    setFormDraft({
      fullName: x.fullName,
      phone: x.phone,
      line1: x.line1,
      area: x.area,
      city: x.city || "Chattagram",
      postalCode: x.postalCode || "",
      instructions: x.instructions || "",
      isDefault: x.isDefault,
    });
    setEditing(x);
    setMsg("");
    setLocationStatus(null);
    setFormKey((k) => k + 1);
  }

  function detectLiveLocation() {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocationStatus({
        type: "error",
        message: "Geolocation is not supported by your device or browser.",
      });
      return;
    }

    setLocating(true);
    setLocationStatus(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const res = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);
          const data = await res.json();

          if (!res.ok || !data.success) {
            throw new Error(data.error || "Could not resolve GPS location");
          }

          const existingForm = formRef.current;
          const existingLine1 =
            (existingForm?.elements.namedItem("line1") as HTMLInputElement)?.value ||
            formDraft.line1 ||
            "";
          const existingNotes =
            (existingForm?.elements.namedItem("instructions") as HTMLTextAreaElement)?.value ||
            formDraft.instructions ||
            "";
          const existingName =
            (existingForm?.elements.namedItem("fullName") as HTMLInputElement)?.value ||
            formDraft.fullName ||
            defaultName;
          const existingPhone =
            (existingForm?.elements.namedItem("phone") as HTMLInputElement)?.value ||
            formDraft.phone ||
            defaultPhone;

          let finalLine1 = data.line1;
          if (existingLine1 && !existingLine1.includes(data.line1)) {
            finalLine1 = `${existingLine1}, ${data.line1}`;
          }

          const cleanNotes = existingNotes.replace(/\n?📍 Live GPS Pin:.*$/g, "").trim();
          const finalNotes = cleanNotes
            ? `${cleanNotes}\n📍 Live GPS Pin: ${data.mapsUrl}`
            : `📍 Live GPS Pin: ${data.mapsUrl}`;

          const isDeliverable =
            data.isDeliverable ??
            ((data.city?.toLowerCase() === "chattagram" || data.city?.toLowerCase() === "chittagong") &&
              (data.distanceKm ?? 0) <= 35);

          setFormDraft({
            fullName: existingName,
            phone: existingPhone,
            line1: finalLine1,
            area: data.area,
            city: data.city || "Chattagram",
            postalCode: formDraft.postalCode || "",
            instructions: finalNotes,
            isDefault: editing === "new" ? initial.length === 0 : formDraft.isDefault,
          });

          if (!editing) {
            setEditing("new");
          }

          setFormKey((k) => k + 1);

          if (!isDeliverable) {
            setLocationStatus({
              type: "warning",
              message: `📍 ${data.area}, ${data.city} — Currently, delivery is not available in this area.`,
              mapsUrl: data.mapsUrl,
              isDeliverable: false,
            });
          } else {
            const feeNote = data.isFreeDelivery ? "Free delivery (within 7 km)" : "Delivery: ৳80";
            setLocationStatus({
              type: "success",
              message: `📍 ${data.area}, ${data.city} — ${feeNote}`,
              mapsUrl: data.mapsUrl,
              isDeliverable: true,
            });
          }
        } catch (err) {
          console.error("Geocoding failed:", err);
          setLocationStatus({
            type: "error",
            message: "Unable to find address from live GPS. Please enter your address manually.",
          });
        } finally {
          setLocating(false);
        }
      },
      (geoError) => {
        setLocating(false);
        let msg = "Could not get your location.";
        if (geoError.code === geoError.PERMISSION_DENIED) {
          msg = "Location permission denied. Please allow location permissions in your browser or type address manually.";
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          msg = "GPS location unavailable on your device.";
        } else if (geoError.code === geoError.TIMEOUT) {
          msg = "Location request timed out. Please try again.";
        }
        setLocationStatus({ type: "error", message: msg });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? "");
    const body = {
      fullName: g("fullName"),
      phone: g("phone"),
      line1: g("line1"),
      area: g("area"),
      city: g("city"),
      postalCode: g("postalCode"),
      instructions: g("instructions"),
      isDefault: f.get("isDefault") === "on",
    };
    setBusy(true);
    setMsg("");
    setFe({});
    const r =
      editing === "new"
        ? await call("/api/account/addresses", "POST", body)
        : await call(`/api/account/addresses/${(editing as AddressDto).id}`, "PUT", body);
    setBusy(false);
    if (r.ok) {
      setEditing(null);
      setLocationStatus(null);
      setMsg("Address saved successfully with live location.");
      router.refresh();
    } else {
      setFe(r.data.details?.fieldErrors ?? {});
      setMsg(
        r.data.error === "Invalid input"
          ? "Please check the highlighted fields."
          : r.data.error ?? "Could not save."
      );
    }
  }

  async function remove(id: string) {
    setBusy(true);
    const r = await call(`/api/account/addresses/${id}`, "DELETE");
    setBusy(false);
    setConfirmId(null);
    setMsg(r.ok ? "Address deleted." : "Could not delete.");
    router.refresh();
  }

  async function makeDefault(id: string) {
    setBusy(true);
    await call(`/api/account/addresses/${id}/default`, "POST");
    setBusy(false);
    setMsg("Default address updated.");
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-6">
      {msg && (
        <p role="status" className="rounded-lg border border-brand/20 bg-mint-light p-3 text-sm font-medium text-deep">
          {msg}
        </p>
      )}

      {/* Main Top Action Bar */}
      {!editing && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={detectLiveLocation}
            disabled={locating || initial.length >= 10}
            className="inline-flex items-center gap-2"
          >
            {locating ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
            <span>{locating ? "Detecting live location…" : "Save Live Location"}</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleStartNew}
            disabled={initial.length >= 10}
            className="inline-flex items-center gap-1.5"
          >
            <Plus size={16} aria-hidden /> Add address manually
          </Button>
        </div>
      )}

      {locating && (
        <div className="flex items-center gap-2.5 rounded-xl border border-brand/20 bg-mint-light/40 p-3.5 text-xs text-brand animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>Accessing device GPS and finding nearest Chattagram street & area…</span>
        </div>
      )}

      {locationStatus && (
        <div
          role="status"
          className={`flex items-start justify-between gap-2 rounded-xl border p-3.5 text-xs ${
            locationStatus.type === "success"
              ? "border-brand/30 bg-mint-light text-deep"
              : locationStatus.type === "warning"
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-danger/30 bg-danger/5 text-danger"
          }`}
        >
          <div className="flex items-start gap-2">
            {locationStatus.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-brand mt-0.5" />
            ) : locationStatus.type === "warning" ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-danger mt-0.5" />
            )}
            <span className="leading-relaxed">{locationStatus.message}</span>
          </div>
          {locationStatus.mapsUrl && (
            <a
              href={locationStatus.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`shrink-0 font-semibold underline inline-flex items-center gap-1 ${
                locationStatus.type === "warning" ? "text-amber-800 hover:text-amber-950" : "text-brand"
              }`}
            >
              View pin <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {/* Edit / New Address Form */}
      {editing && (
        <form
          ref={formRef}
          key={formKey}
          onSubmit={save}
          className="card max-w-2xl space-y-4 p-6"
          noValidate
          aria-label={editing === "new" ? "Add address" : "Edit address"}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-hairline/60 pb-3">
            <div>
              <h2 className="text-lg font-bold text-deep">
                {editing === "new" ? "Add a new address" : "Edit address"}
              </h2>
              <p className="text-xs text-ink-soft">Save delivery location for quick checkout</p>
            </div>
            <button
              type="button"
              onClick={detectLiveLocation}
              disabled={locating}
              className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-brand/30 bg-mint-light/70 px-3 py-1.5 text-xs font-semibold text-brand transition-all hover:bg-mint-light hover:border-brand disabled:opacity-60 cursor-pointer shadow-sm"
            >
              {locating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                  <span>Detecting location…</span>
                </>
              ) : (
                <>
                  <MapPin className="h-3.5 w-3.5 text-brand" />
                  <span>Auto-fill Live Location</span>
                </>
              )}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="Full name"
              name="fullName"
              required
              defaultValue={formDraft.fullName}
              error={fe.fullName?.[0]}
            />
            <TextInput
              label="Mobile number"
              name="phone"
              required
              inputMode="tel"
              placeholder="01XXXXXXXXX"
              defaultValue={formDraft.phone}
              error={fe.phone?.[0]}
            />
          </div>

          <TextInput
            label="Address"
            name="line1"
            required
            placeholder="House, road, block"
            defaultValue={formDraft.line1}
            error={fe.line1?.[0]}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <TextInput
                label="Area"
                name="area"
                required
                list="ctg-areas"
                placeholder="e.g. Chandgaon"
                defaultValue={formDraft.area}
                error={fe.area?.[0]}
              />
              <datalist id="ctg-areas">
                {CHATTOGRAM_AREAS.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>
            <TextInput
              label="City"
              name="city"
              required
              defaultValue={formDraft.city || "Chattagram"}
              error={fe.city?.[0]}
            />
            <TextInput
              label="Postal code"
              name="postalCode"
              inputMode="numeric"
              maxLength={4}
              defaultValue={formDraft.postalCode}
              error={fe.postalCode?.[0]}
            />
          </div>

          <TextArea
            label="Delivery instructions & GPS pin (optional)"
            name="instructions"
            rows={2}
            defaultValue={formDraft.instructions}
            error={fe.instructions?.[0]}
          />

          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              name="isDefault"
              defaultChecked={formDraft.isDefault}
              className="h-5 w-5 accent-brand"
            />
            Make this my default address
          </label>

          {formDraft.city && !(formDraft.city.toLowerCase() === "chattagram" || formDraft.city.toLowerCase() === "chittagong" || formDraft.city.toLowerCase().includes("chatt")) && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                <strong>Notice:</strong> Currently, delivery is not available in this area (available in Chattagram only).
              </span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button disabled={busy}>{busy ? "Saving…" : "Save address"}</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(null);
                setLocationStatus(null);
                setFe({});
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Address List */}
      {initial.length === 0 && !editing ? (
        <div className="rounded-xl border border-dashed border-ink-soft/40 bg-white p-10 text-center">
          <p className="font-bold text-deep">No saved addresses</p>
          <p className="mt-1 text-sm text-ink-soft">
            Click <strong>Save Live Location</strong> to automatically detect and store your address.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {initial.map((x) => {
            const gpsMatch = x.instructions?.match(
              /https:\/\/(?:www\.)?(?:google\.com\/maps[^\s)]+|maps\.google\.com[^\s)]+)/
            );
            const gpsUrl = gpsMatch ? gpsMatch[0] : null;

            return (
              <li key={x.id} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold text-deep">
                    <MapPin size={16} className="text-leaf shrink-0" aria-hidden />
                    {x.fullName}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 justify-end">
                    {x.isDefault && (
                      <span className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-bold text-deep">
                        Default
                      </span>
                    )}
                    {x.city && !(x.city.toLowerCase() === "chattagram" || x.city.toLowerCase() === "chittagong" || x.city.toLowerCase().includes("chatt")) && (
                      <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 text-xs font-semibold">
                        Delivery currently not available
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink">
                  {x.line1}
                  <br />
                  <span className="font-medium text-deep">{x.area}</span>, {x.city}
                  {x.postalCode && ` ${x.postalCode}`}
                  <br />
                  <span className="text-ink-soft">{x.phone}</span>
                  {x.instructions && (
                    <span className="mt-1.5 block text-xs text-ink-soft italic whitespace-pre-line">
                      Note: {x.instructions}
                    </span>
                  )}
                </p>

                {gpsUrl && (
                  <div className="mt-2.5">
                    <a
                      href={gpsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <MapPin size={12} className="text-emerald-600" /> View Live GPS Pin{" "}
                      <ExternalLink size={10} />
                    </a>
                  </div>
                )}

                {confirmId === x.id ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-sm border-t border-hairline pt-3">
                    <span className="font-medium">Delete this address?</span>
                    <Button variant="outline" disabled={busy} onClick={() => remove(x.id)}>
                      Yes, delete
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmId(null)}>
                      Keep
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-3">
                    <Button
                      variant="outline"
                      onClick={() => handleStartEdit(x)}
                      aria-label={`Edit address for ${x.fullName}`}
                    >
                      <Pencil size={15} aria-hidden /> Edit
                    </Button>
                    {!x.isDefault && (
                      <Button variant="ghost" disabled={busy} onClick={() => makeDefault(x.id)}>
                        Set as default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => setConfirmId(x.id)}
                      aria-label={`Delete address for ${x.fullName}`}
                    >
                      <Trash2 size={15} aria-hidden /> Delete
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
