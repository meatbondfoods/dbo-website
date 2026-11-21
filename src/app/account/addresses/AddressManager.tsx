"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Loader2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Phone,
  Crosshair,
  RotateCcw,
} from "lucide-react";
import type { AddressDto } from "@/lib/auth/types";
import { TextArea, TextInput } from "@/components/ui/FormControls";
import { Button } from "@/components/ui/Button";
import { CANONICAL_CHATTOGRAM_AREAS, haversineKm } from "@/lib/geocode";

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

interface GpsData {
  lat: number;
  lon: number;
  mapsUrl: string;
  area?: string;
  city?: string;
  distanceKm?: number;
  isDeliverable?: boolean;
  isFreeDelivery?: boolean;
  deliveryMessage?: string;
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

const POPULAR_AREAS = [
  "Chandgaon",
  "Bahaddarhat",
  "GEC Circle",
  "Panchlaish",
  "Agrabad",
  "Khulshi",
  "Halishahar",
  "Chawkbazar",
];

function isCityChattagram(city?: string | null): boolean {
  if (!city) return true;
  const c = city.trim().toLowerCase();
  return c === "chattagram" || c === "chittagong" || c.includes("chatt") || c.includes("chitt");
}

function parseGpsFromInstructions(instructions?: string | null): {
  cleanInstructions: string;
  gpsUrl: string | null;
  coords: { lat: number; lon: number } | null;
} {
  if (!instructions) return { cleanInstructions: "", gpsUrl: null, coords: null };

  const match = instructions.match(
    /https?:\/\/(?:www\.)?(?:google\.com\/maps[^\s)]+|maps\.google\.com[^\s)]+)/i
  );
  const gpsUrl = match ? match[0] : null;

  let coords: { lat: number; lon: number } | null = null;
  if (gpsUrl) {
    const qMatch = gpsUrl.match(/[?&]q=([0-9.-]+),([0-9.-]+)/);
    if (qMatch) {
      const lat = parseFloat(qMatch[1]);
      const lon = parseFloat(qMatch[2]);
      if (!isNaN(lat) && !isNaN(lon)) {
        coords = { lat, lon };
      }
    }
  }

  // Remove GPS markers and bare maps URLs from delivery instructions
  const cleanInstructions = instructions
    .replace(/(?:[\r\n]+)?📍\s*(?:Live\s*)?GPS\s*Pin:[^\r\n]*/gi, "")
    .replace(
      /(?:[\r\n]+)?https?:\/\/(?:www\.)?(?:google\.com\/maps[^\s)]+|maps\.google\.com[^\s)]*)/gi,
      ""
    )
    .trim();

  return { cleanInstructions, gpsUrl, coords };
}

function formatCoordinates(lat?: number, lon?: number): string {
  if (lat === undefined || lon === undefined || (lat === 0 && lon === 0)) return "";
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
}

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

  const [gpsData, setGpsData] = useState<GpsData | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<{
    type: "success" | "warning" | "error";
    message: string;
    mapsUrl?: string;
    isDeliverable?: boolean;
  } | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
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
    setGpsData(null);
    setEditing("new");
    setMsg(null);
    setLocationStatus(null);
    setFe({});
    setFormKey((k) => k + 1);
  }

  function handleStartEdit(x: AddressDto) {
    const { cleanInstructions, gpsUrl, coords } = parseGpsFromInstructions(x.instructions);

    setFormDraft({
      fullName: x.fullName,
      phone: x.phone,
      line1: x.line1,
      area: x.area,
      city: x.city || "Chattagram",
      postalCode: x.postalCode || "",
      instructions: cleanInstructions,
      isDefault: x.isDefault,
    });

    if (gpsUrl) {
      const isDeliverable = isCityChattagram(x.city);
      setGpsData({
        lat: coords?.lat ?? 0,
        lon: coords?.lon ?? 0,
        mapsUrl: gpsUrl,
        area: x.area,
        city: x.city,
        isDeliverable,
      });
    } else {
      setGpsData(null);
    }

    setEditing(x);
    setMsg(null);
    setLocationStatus(null);
    setFe({});
    setFormKey((k) => k + 1);
  }

  function applyQuickArea(areaName: string) {
    const canonical = CANONICAL_CHATTOGRAM_AREAS.find(
      (a) => a.name.toLowerCase() === areaName.toLowerCase()
    );
    const lat = canonical?.lat ?? 22.3811;
    const lon = canonical?.lon ?? 91.8482;
    const distToHub = Math.round(haversineKm(lat, lon, 22.3811, 91.8482) * 10) / 10;
    const isFree = distToHub <= 7;

    setGpsData({
      lat,
      lon,
      mapsUrl: `https://www.google.com/maps?q=${lat},${lon}`,
      area: areaName,
      city: "Chattagram",
      distanceKm: distToHub,
      isDeliverable: true,
      isFreeDelivery: isFree,
      deliveryMessage: isFree ? "Free delivery (within 7 km)" : "Delivery: ৳80",
    });

    setFormDraft((prev) => ({
      ...prev,
      area: areaName,
      city: "Chattagram",
    }));

    if (!editing) setEditing("new");

    setLocationStatus({
      type: "success",
      message: `📍 ${areaName}, Chattagram — ${isFree ? "Free delivery (within 7 km)" : "Delivery: ৳80"}`,
      mapsUrl: `https://www.google.com/maps?q=${lat},${lon}`,
      isDeliverable: true,
    });
    setFormKey((k) => k + 1);
  }

  async function detectLiveLocation() {
    setLocating(true);
    setLocationStatus(null);

    // Multi-tier position retrieval: Prioritize High-Accuracy Wi-Fi / Hardware GPS first!
    const getCoords = async (): Promise<{ lat: number; lon: number; source: "gps" | "network" }> => {
      if (typeof window !== "undefined" && "geolocation" in navigator) {
        // Pass 1: High Accuracy GPS / Wi-Fi Triangulation FIRST (6.5s timeout, maximumAge: 0)
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 6500,
              maximumAge: 0,
            });
          });
          return { lat: pos.coords.latitude, lon: pos.coords.longitude, source: "gps" };
        } catch (err: any) {
          // If high accuracy times out or fails (e.g. PC without Wi-Fi), try quick coarse pass
        }

        // Pass 2: Quick fallback with low accuracy (2.5s timeout)
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 2500,
              maximumAge: 10000,
            });
          });
          return { lat: pos.coords.latitude, lon: pos.coords.longitude, source: "gps" };
        } catch (err: any) {
          // Fall through to Pass 3
        }
      }

      // Pass 3: Automatic Network / IP Location fallback
      const ipRes = await fetch("/api/geocode").catch(() => null);
      if (ipRes && ipRes.ok) {
        const ipData = await ipRes.json().catch(() => null);
        if (ipData?.latitude && ipData?.longitude) {
          return { lat: ipData.latitude, lon: ipData.longitude, source: "network" };
        }
      }

      // Default: Chandgaon Hub
      return { lat: 22.3811, lon: 91.8482, source: "network" };
    };

    try {
      const coords = await getCoords();
      const res = await fetch(`/api/geocode?lat=${coords.lat}&lon=${coords.lon}`);
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

      let finalLine1 = data.line1 || "";
      if (existingLine1 && !existingLine1.includes(data.line1)) {
        finalLine1 = `${existingLine1}, ${data.line1}`;
      }

      const isDeliverable =
        data.isDeliverable ??
        (isCityChattagram(data.city) && (data.distanceKm ?? 0) <= 35);

      const feeNote = data.isFreeDelivery
        ? "Free delivery (within 7 km)"
        : "Delivery: ৳80";

      setGpsData({
        lat: coords.lat,
        lon: coords.lon,
        mapsUrl: data.mapsUrl || `https://www.google.com/maps?q=${coords.lat},${coords.lon}`,
        area: data.area,
        city: data.city || "Chattagram",
        distanceKm: data.distanceKm,
        isDeliverable,
        isFreeDelivery: data.isFreeDelivery,
        deliveryMessage: isDeliverable
          ? feeNote
          : "Currently, delivery is not available in this area.",
      });

      setFormDraft({
        fullName: existingName,
        phone: existingPhone,
        line1: finalLine1,
        area: data.area || formDraft.area,
        city: data.city || "Chattagram",
        postalCode: formDraft.postalCode || "",
        instructions: existingNotes,
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
        setLocationStatus({
          type: "success",
          message: `📍 ${data.area}, ${data.city} — ${feeNote}${coords.source === "network" ? " (via network)" : ""}`,
          mapsUrl: data.mapsUrl,
          isDeliverable: true,
        });
      }
    } catch (err: any) {
      let msg = "Device location unavailable. Please select your area below or enter address manually.";
      if (err?.code === 1) {
        msg = "Location permission is blocked in your browser. Please allow location access or select your area below.";
      }
      setLocationStatus({ type: "error", message: msg });
      if (!editing) setEditing("new");
    } finally {
      setLocating(false);
    }
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? "").trim();

    // Keep delivery notes clean; encode GPS pin cleanly into instructions for storage & driver tooling
    const cleanNotes = g("instructions");
    const finalNotes = gpsData?.mapsUrl
      ? cleanNotes
        ? `${cleanNotes}\n📍 Live GPS Pin: ${gpsData.mapsUrl}`
        : `📍 Live GPS Pin: ${gpsData.mapsUrl}`
      : cleanNotes;

    const body = {
      fullName: g("fullName"),
      phone: g("phone"),
      line1: g("line1"),
      area: g("area"),
      city: g("city"),
      postalCode: g("postalCode"),
      instructions: finalNotes.slice(0, 300),
      isDefault: f.get("isDefault") === "on",
    };

    setBusy(true);
    setMsg(null);
    setFe({});

    const r =
      editing === "new"
        ? await call("/api/account/addresses", "POST", body)
        : await call(`/api/account/addresses/${(editing as AddressDto).id}`, "PUT", body);

    setBusy(false);
    if (r.ok) {
      setEditing(null);
      setLocationStatus(null);
      setGpsData(null);
      setMsg({ type: "success", text: "Delivery address saved successfully." });
      router.refresh();
    } else {
      setFe(r.data.details?.fieldErrors ?? {});
      setMsg({
        type: "error",
        text:
          r.data.error === "Invalid input"
            ? "Please check the highlighted fields below."
            : r.data.error ?? "Could not save address. Please try again.",
      });
    }
  }

  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    const r = await call(`/api/account/addresses/${id}`, "DELETE");
    setBusy(false);
    setConfirmId(null);
    if (r.ok) {
      setMsg({ type: "success", text: "Address deleted successfully." });
      router.refresh();
    } else {
      setMsg({ type: "error", text: "Could not delete address. Please try again." });
    }
  }

  async function makeDefault(id: string) {
    if (busy) return;
    setBusy(true);
    const r = await call(`/api/account/addresses/${id}/default`, "POST");
    setBusy(false);
    if (r.ok) {
      setMsg({ type: "success", text: "Default delivery address updated." });
      router.refresh();
    } else {
      setMsg({ type: "error", text: "Could not update default address." });
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {msg && (
        <div
          role="status"
          className={`flex items-center gap-2.5 rounded-xl border p-4 text-sm font-medium transition-all ${
            msg.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-[#0B3B17]"
              : "border-red-300 bg-red-50 text-danger"
          }`}
        >
          {msg.type === "success" ? (
            <CheckCircle2 size={18} className="text-leaf shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-danger shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Main Top Action Bar */}
      {!editing && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-deep">
              Saved Delivery Addresses{" "}
              <span className="text-xs font-semibold text-ink-soft">
                ({initial.length} of 10)
              </span>
            </h2>
            <p className="text-xs text-ink-soft mt-0.5">
              {initial.length === 0
                ? "You have not saved any delivery addresses yet."
                : "Select or manage your addresses for express chilled checkout"}
            </p>
          </div>

          {/* Only show top action buttons when there are already saved addresses to prevent duplicate buttons */}
          {initial.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                onClick={detectLiveLocation}
                disabled={locating || initial.length >= 10}
                className="inline-flex items-center gap-2 shadow-soft hover:shadow-lift transition-all"
              >
                {locating ? (
                  <Loader2 size={16} className="animate-spin text-white" />
                ) : (
                  <Crosshair size={16} className="text-white" />
                )}
                <span>{locating ? "Detecting GPS…" : "Save Live Location"}</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleStartNew}
                disabled={initial.length >= 10}
                className="inline-flex items-center gap-1.5"
              >
                <Plus size={16} aria-hidden />
                <span>Add address manually</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Live Locating Pulse Banner */}
      {locating && (
        <div className="flex items-center gap-3 rounded-2xl border border-brand/20 bg-mint-light/50 p-4 text-xs font-semibold text-brand animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin shrink-0 text-[#0B3B17]" />
          <span>Accessing device GPS & network location for nearest Chattagram address…</span>
        </div>
      )}

      {/* Location Status Banner with Fast Area Fallback */}
      {locationStatus && (
        <div
          role="status"
          className={`rounded-2xl border p-4 text-xs font-medium space-y-2.5 ${
            locationStatus.type === "success"
              ? "border-emerald-300 bg-emerald-50/80 text-[#0B3B17]"
              : locationStatus.type === "warning"
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-danger/30 bg-danger/5 text-danger"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              {locationStatus.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-leaf mt-0.5" />
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
                  locationStatus.type === "warning"
                    ? "text-amber-800 hover:text-amber-950"
                    : "text-brand hover:text-deep"
                }`}
              >
                View pin <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Quick Area Buttons if location is out of delivery area or unavailable */}
          {(locationStatus.type === "error" || locationStatus.type === "warning") && (
            <div
              className={`pt-2.5 border-t flex flex-wrap items-center gap-1.5 ${
                locationStatus.type === "error" ? "border-danger/20" : "border-amber-200"
              }`}
            >
              <span
                className={`font-semibold text-[11px] mr-1 ${
                  locationStatus.type === "error" ? "text-danger" : "text-amber-900"
                }`}
              >
                Delivering to Chattagram? Quick select area:
              </span>
              {POPULAR_AREAS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => applyQuickArea(a)}
                  className="rounded-lg border border-brand/30 bg-white px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-mint-light hover:border-brand cursor-pointer shadow-xs transition-colors"
                >
                  📍 {a}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit / New Address Form */}
      {editing && (
        <form
          ref={formRef}
          key={formKey}
          onSubmit={save}
          className="card max-w-2xl space-y-6 p-6 sm:p-8 rounded-2xl border border-hairline/90 shadow-soft bg-white"
          noValidate
          aria-label={editing === "new" ? "Add address" : "Edit address"}
        >
          {/* Form Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-hairline/80 pb-4">
            <div>
              <span className="eyebrow block">Delivery Destination</span>
              <h2 className="text-xl font-bold text-deep">
                {editing === "new" ? "Add a new address" : "Edit delivery address"}
              </h2>
              <p className="text-xs text-ink-soft mt-0.5">
                Save your contact and street details. Pin live GPS for accurate rider arrival.
              </p>
            </div>
            <button
              type="button"
              onClick={detectLiveLocation}
              disabled={locating}
              className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-brand/30 bg-mint-light/70 px-3.5 py-2 text-xs font-semibold text-brand transition-all hover:bg-mint-light hover:border-brand disabled:opacity-60 cursor-pointer shadow-xs shrink-0"
            >
              {locating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                  <span>Detecting GPS…</span>
                </>
              ) : (
                <>
                  <Crosshair className="h-3.5 w-3.5 text-brand" />
                  <span>Auto-fill Live Location</span>
                </>
              )}
            </button>
          </div>

          {/* Section 1: Contact Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-leaf">
              1. Contact Information
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="Full name"
                name="fullName"
                required
                placeholder="Recipient name"
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
          </div>

          {/* Section 2: Street & Postal */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-leaf">
              2. Street & Area Address
            </h3>
            <TextInput
              label="Street address"
              name="line1"
              required
              placeholder="House, road, flat or building name"
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
                placeholder="e.g. 4212"
                defaultValue={formDraft.postalCode}
                error={fe.postalCode?.[0]}
              />
            </div>

            {/* Popular Area Quick Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-semibold text-ink-soft">Popular areas:</span>
              {POPULAR_AREAS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => applyQuickArea(a)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                    formDraft.area.toLowerCase() === a.toLowerCase()
                      ? "border-brand bg-mint-light text-[#0B3B17] font-bold"
                      : "border-hairline bg-stone-50 text-ink-soft hover:bg-white hover:text-deep"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Dedicated GPS Location Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-leaf">
                3. Delivery GPS Location
              </h3>
              {gpsData && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-[#0B3B17] border border-emerald-300">
                  <CheckCircle2 size={12} className="text-leaf" /> Pin Attached
                </span>
              )}
            </div>

            <div className="rounded-2xl border border-hairline/80 bg-stone-50/70 p-4 sm:p-5 space-y-3">
              {gpsData ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl bg-white p-3.5 border border-hairline text-xs">
                    <div>
                      <span className="text-ink-soft block text-[11px] font-semibold uppercase tracking-wider">
                        GPS Coordinates
                      </span>
                      <span className="font-mono font-bold text-deep text-sm block mt-0.5">
                        {formatCoordinates(gpsData.lat, gpsData.lon) || "Live GPS Coordinates Attached"}
                      </span>
                      {gpsData.area && (
                        <span className="text-ink-soft text-xs block mt-1">
                          Detected near <strong className="text-deep font-semibold">{gpsData.area}</strong>, {gpsData.city}
                          {gpsData.distanceKm !== undefined &&
                            ` (${gpsData.distanceKm.toFixed(1)} km from Chandgaon hub)`}
                        </span>
                      )}
                    </div>
                    <div>
                      {gpsData.isDeliverable === false ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 border border-amber-200">
                          <AlertCircle size={12} className="text-amber-600" />
                          Delivery unavailable in this area
                        </span>
                      ) : gpsData.isFreeDelivery ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-mint-light px-2.5 py-1 text-xs font-bold text-[#0B3B17] border border-brand/20">
                          <CheckCircle2 size={12} className="text-leaf" /> Free delivery (within 7 km)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-deep border border-stone-200">
                          Delivery: ৳80
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions: View on Google Maps, Change Location, Remove Location */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <a
                      href={gpsData.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-deep hover:bg-stone-50 transition-colors shadow-xs"
                    >
                      <ExternalLink size={13} className="text-leaf" /> View on Google Maps
                    </a>
                    <button
                      type="button"
                      onClick={detectLiveLocation}
                      disabled={locating}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-brand/30 bg-mint-light/60 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-mint-light transition-colors cursor-pointer"
                    >
                      {locating ? (
                        <Loader2 size={13} className="animate-spin text-brand" />
                      ) : (
                        <RotateCcw size={13} />
                      )}
                      <span>{locating ? "Re-detecting…" : "Change Location"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGpsData(null);
                        setLocationStatus(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-transparent px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 transition-colors cursor-pointer ml-auto"
                    >
                      <Trash2 size={13} /> Remove Location
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-deep">
                      No GPS coordinates attached
                    </p>
                    <p className="text-xs text-ink-soft mt-0.5">
                      Attaching your device GPS helps our chilled delivery riders find your gate without calling for directions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={detectLiveLocation}
                    disabled={locating}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-brand/30 bg-mint-light/70 px-3.5 py-2 text-xs font-semibold text-brand hover:bg-mint-light hover:border-brand transition-all cursor-pointer shadow-xs disabled:opacity-60 shrink-0"
                  >
                    {locating ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-brand" />
                        <span>Detecting location…</span>
                      </>
                    ) : (
                      <>
                        <Crosshair size={14} className="text-brand" />
                        <span>Attach Live GPS Location</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Pure Driver Delivery Instructions */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-leaf">
              4. Delivery Instructions (Optional)
            </h3>
            <TextArea
              label="Driver notes"
              name="instructions"
              rows={2}
              placeholder="e.g. Leave with building security, 3rd floor apartment on the left, gate bell..."
              defaultValue={formDraft.instructions}
              error={fe.instructions?.[0]}
              hint="Delivery instructions are kept separate from GPS coordinates to ensure clear driver guidance."
            />
          </div>

          {/* Section 5: Default address checkbox */}
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium rounded-xl border border-hairline/80 bg-stone-50/50 p-3 hover:bg-stone-50 transition-colors">
            <input
              type="checkbox"
              name="isDefault"
              defaultChecked={formDraft.isDefault}
              className="h-5 w-5 accent-brand rounded cursor-pointer"
            />
            <span className="text-deep font-semibold">
              Make this my default delivery address
            </span>
          </label>

          {/* Availability warning for non-Chattagram address */}
          {formDraft.city && !isCityChattagram(formDraft.city) && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="font-medium">
                Currently, delivery is not available in this area.
              </span>
            </div>
          )}

          {/* Form Actions: Save & Cancel */}
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-hairline/80">
            <Button
              type="submit"
              disabled={busy}
              className="min-w-[140px] inline-flex items-center justify-center gap-2 shadow-soft hover:shadow-lift transition-all"
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  <span>Saving address…</span>
                </>
              ) : (
                <span>Save address</span>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setLocationStatus(null);
                setGpsData(null);
                setFe({});
              }}
              className="min-w-[100px] inline-flex items-center justify-center gap-2"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Address List Cards */}
      {initial.length === 0 && !editing ? (
        <div className="rounded-2xl border border-dashed border-ink-soft/30 bg-white p-12 text-center shadow-soft">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-mint-light text-[#0B3B17] border border-[#0B3B17]/20">
            <MapPin size={24} />
          </div>
          <h3 className="mt-4 text-base font-bold text-deep">No saved addresses yet</h3>
          <p className="mt-1 text-sm text-ink-soft max-w-md mx-auto">
            Click <strong>Save Live Location</strong> to automatically detect your address with device GPS, or choose your area below.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={detectLiveLocation} disabled={locating} className="inline-flex items-center gap-2">
              <Crosshair size={16} /> Save Live Location
            </Button>
            <Button variant="outline" onClick={handleStartNew} className="inline-flex items-center gap-1.5">
              <Plus size={16} /> Add manually
            </Button>
          </div>
        </div>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2">
          {initial.map((x) => {
            const { cleanInstructions, gpsUrl, coords } = parseGpsFromInstructions(x.instructions);
            const isOutside = !isCityChattagram(x.city);

            return (
              <li
                key={x.id}
                className="card flex flex-col justify-between p-5 sm:p-6 rounded-2xl border border-hairline/80 shadow-soft hover:shadow-lift transition-all bg-white"
              >
                <div>
                  {/* Card Header: Name & Status Badges */}
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex items-center gap-2 font-bold text-deep text-base">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-mint-light text-[#0B3B17]">
                        <MapPin size={16} />
                      </span>
                      <span>{x.fullName}</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 justify-end">
                      {x.isDefault && (
                        <span className="rounded-full bg-mint-light px-2.5 py-0.5 text-xs font-bold text-[#0B3B17] border border-[#0B3B17]/20">
                          Default
                        </span>
                      )}
                      {isOutside && (
                        <span className="rounded-full bg-amber-50 text-amber-900 border border-amber-300 px-2.5 py-0.5 text-xs font-semibold">
                          Outside delivery zone
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body: Address Details */}
                  <div className="mt-3.5 space-y-1.5 text-sm text-ink">
                    <p className="font-medium text-deep leading-relaxed">{x.line1}</p>
                    <p className="text-ink-soft">
                      <span className="font-semibold text-deep">{x.area}</span>, {x.city}
                      {x.postalCode && ` · Postal: ${x.postalCode}`}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft pt-1">
                      <Phone size={13} className="text-leaf" />
                      <span>{x.phone}</span>
                    </p>
                  </div>

                  {/* Delivery Instructions (Separated from GPS) */}
                  {cleanInstructions && (
                    <div className="mt-3 rounded-xl bg-stone-50/80 p-2.5 border border-stone-200/70 text-xs text-ink-soft">
                      <span className="font-bold text-deep block mb-0.5">Delivery note:</span>
                      <p className="italic leading-relaxed">{cleanInstructions}</p>
                    </div>
                  )}

                  {/* Dedicated GPS Information Section on Saved Card */}
                  <div className="mt-3.5 pt-3 border-t border-hairline/70">
                    {gpsUrl ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50/60 p-2.5 border border-emerald-200/70 text-xs">
                        <div className="flex items-center gap-1.5 text-[#0B3B17] font-semibold">
                          <CheckCircle2 size={14} className="text-leaf shrink-0" />
                          <span>
                            {coords
                              ? formatCoordinates(coords.lat, coords.lon)
                              : "Live GPS Pin Attached"}
                          </span>
                        </div>
                        <a
                          href={gpsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-brand hover:text-deep underline"
                        >
                          View pin <ExternalLink size={11} />
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                        <span className="h-1.5 w-1.5 rounded-full bg-stone-300" />
                        <span>No GPS coordinates pinned</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="mt-5 pt-3.5 border-t border-hairline/80">
                  {confirmId === x.id ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-danger">Delete this address?</span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => remove(x.id)}
                          className="text-xs min-h-[36px] px-3 border-danger/40 text-danger hover:bg-danger/10"
                        >
                          {busy ? "Deleting…" : "Yes, delete"}
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setConfirmId(null)}
                          className="text-xs min-h-[36px] px-3 text-ink-soft"
                        >
                          Keep
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleStartEdit(x)}
                          aria-label={`Edit address for ${x.fullName}`}
                          className="text-xs min-h-[36px] px-3.5 inline-flex items-center gap-1.5"
                        >
                          <Pencil size={13} aria-hidden /> Edit
                        </Button>
                        {!x.isDefault && (
                          <Button
                            variant="ghost"
                            disabled={busy}
                            onClick={() => makeDefault(x.id)}
                            className="text-xs min-h-[36px] px-3 text-brand hover:text-deep"
                          >
                            Set default
                          </Button>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => setConfirmId(x.id)}
                        aria-label={`Delete address for ${x.fullName}`}
                        className="text-xs min-h-[36px] px-2.5 text-ink-soft hover:text-danger hover:bg-danger/5 ml-auto"
                      >
                        <Trash2 size={14} aria-hidden />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
