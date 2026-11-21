export interface GeocodeResult {
  line1: string;
  area: string;
  city: string;
  latitude: number;
  longitude: number;
  mapsUrl: string;
  distanceKm?: number;
  isFreeDelivery?: boolean;
  isDeliverable?: boolean;
  deliveryMessage?: string;
  rawAddress?: string;
}

export const CHATTOGRAM_CENTER = { lat: 22.3811, lon: 91.8482 };
export const MAX_CHATTOGRAM_DELIVERY_RADIUS_KM = 35;

export function isChattagram(city?: string, distanceKm?: number): boolean {
  if (!city) return false;
  const c = city.trim().toLowerCase();
  const isCtgCity = c === "chattagram" || c === "chittagong" || c.includes("chatt") || c.includes("chitt");
  if (!isCtgCity) return false;
  if (distanceKm !== undefined && distanceKm > MAX_CHATTOGRAM_DELIVERY_RADIUS_KM) return false;
  return true;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Canonical Chattagram / CTG areas (Office located at Chandgaon, Chattagram). */
export const CANONICAL_CHATTOGRAM_AREAS: Array<{
  name: string;
  lat: number;
  lon: number;
  keywords: string[];
}> = [
  { name: "Chandgaon", lat: 22.3811, lon: 91.8482, keywords: ["chandgaon", "kalamia", "mohaldar", "chandgaon thana", "chandgaon r/a"] },
  { name: "Bahaddarhat", lat: 22.3705, lon: 91.8425, keywords: ["bahaddarhat", "bus terminal", "arafan"] },
  { name: "Panchlaish", lat: 22.365, lon: 91.829, keywords: ["panchlaish", "cmc", "chattogram medical", "prabartak", "badshah meah"] },
  { name: "GEC Circle", lat: 22.3595, lon: 91.8215, keywords: ["gec", "gec circle", "nasirabad", "sanmar", "golpahar"] },
  { name: "Nasirabad", lat: 22.362, lon: 91.823, keywords: ["nasirabad", "housing society", "solashahar", "east nasirabad"] },
  { name: "Khulshi", lat: 22.366, lon: 91.808, keywords: ["khulshi", "south khulshi", "north khulshi", "concord"] },
  { name: "Agrabad", lat: 22.3255, lon: 91.812, keywords: ["agrabad", "badamtoli", "chittagong chamber", "commercial area", "access road"] },
  { name: "Chawkbazar", lat: 22.3565, lon: 91.8385, keywords: ["chawkbazar", "chittagong college", "mohsin college", "sirajuddowla"] },
  { name: "Halishahar", lat: 22.335, lon: 91.775, keywords: ["halishahar", "boropol", "rampura ctg", "block a", "block b"] },
  { name: "Muradpur", lat: 22.369, lon: 91.834, keywords: ["muradpur", "bibirhat", "mirzarpool"] },
  { name: "Sholashahar", lat: 22.363, lon: 91.828, keywords: ["sholashahar", "solashahar", "railway gate", "gate no 2"] },
  { name: "Lalkhan Bazar", lat: 22.351, lon: 91.818, keywords: ["lalkhan bazar", "tigerpass", "ispahani", "dampara"] },
  { name: "Mehedibag", lat: 22.356, lon: 91.824, keywords: ["mehedibag", "national hospital", "golpahar mor"] },
  { name: "Kotwali", lat: 22.339, lon: 91.836, keywords: ["kotwali", "anderkilla", "kc dey road", "terribazar", "laldighi"] },
  { name: "New Market", lat: 22.334, lon: 91.832, keywords: ["new market", "station road", "reazuddin bazar", "jubilee road", "ennayet bazar"] },
  { name: "Oxygen", lat: 22.4, lon: 91.815, keywords: ["oxygen", "kulgaon", "ananya residential", "baluchara"] },
  { name: "Bayezid", lat: 22.385, lon: 91.81, keywords: ["bayezid", "baizid", "tannery", "cantonment ctg"] },
  { name: "Bakalia", lat: 22.348, lon: 91.851, keywords: ["bakalia", "shah amanat bridge", "kalamia bazar", "rajakhali"] },
  { name: "Pahartali", lat: 22.365, lon: 91.775, keywords: ["pahartali", "railway workshop", "sagorika", "faujdarhat"] },
  { name: "Patenga", lat: 22.285, lon: 91.785, keywords: ["patenga", "epz", "sea beach", "airport road ctg", "chittagong port"] },
];

export const CANONICAL_DHAKA_AREAS: Array<{
  name: string;
  lat: number;
  lon: number;
  keywords: string[];
}> = [
  { name: "Banani", lat: 23.7937, lon: 90.404, keywords: ["banani", "chairman bari", "kemal ataturk"] },
  { name: "Gulshan", lat: 23.7925, lon: 90.4167, keywords: ["gulshan", "korail", "shooting club"] },
  { name: "Baridhara", lat: 23.7998, lon: 90.4208, keywords: ["baridhara", "dohs baridhara", "diplomatic zone"] },
  { name: "Bashundhara", lat: 23.8151, lon: 90.4255, keywords: ["bashundhara", "evercare", "iub", "nsu"] },
  { name: "Uttara", lat: 23.8759, lon: 90.3795, keywords: ["uttara", "sector", "nalbhog", "diabari", "azampur", "jasimuddin"] },
  { name: "Dhanmondi", lat: 23.7461, lon: 90.3742, keywords: ["dhanmondi", "satmasjid", "sobhahanbagh"] },
  { name: "Mirpur", lat: 23.8071, lon: 90.3686, keywords: ["mirpur", "pallabi", "senpara", "kazipara", "shewrapara", "rokeya sarani"] },
  { name: "Mohakhali", lat: 23.7776, lon: 90.4005, keywords: ["mohakhali", "dohs mohakhali", "icddr", "wireless gate"] },
  { name: "Tejgaon", lat: 23.7597, lon: 90.3925, keywords: ["tejgaon", "tejkunipara", "nabisco", "tibet", "industrial area"] },
  { name: "Mohammadpur", lat: 23.7658, lon: 90.3585, keywords: ["mohammadpur", "lalmatia", "adabor", "japan garden", "town hall"] },
  { name: "Badda", lat: 23.7806, lon: 90.4267, keywords: ["badda", "merul", "middle badda", "south badda", "pragoti sarani"] },
  { name: "Rampura", lat: 23.7612, lon: 90.4208, keywords: ["rampura", "banasree", "aftabnagar", "bonosree"] },
  { name: "Khilgaon", lat: 23.7533, lon: 90.4255, keywords: ["khilgaon", "taltola", "goran", "tilpapara"] },
  { name: "Malibagh", lat: 23.748, lon: 90.408, keywords: ["malibagh", "mouchak", "maghbazar", "shantinagar"] },
  { name: "Motijheel", lat: 23.733, lon: 90.4172, keywords: ["motijheel", "dilkusha", "shapla chattar", "paltan", "fakirapool"] },
  { name: "Old Dhaka", lat: 23.715, lon: 90.39, keywords: ["lalbagh", "sadarghat", "wari", "gandaria", "sutrapur", "chawkbazar"] },
  { name: "Nikunja", lat: 23.83, lon: 90.418, keywords: ["nikunja", "khilkhet", "kuril"] },
  { name: "Cantonment", lat: 23.82, lon: 90.395, keywords: ["cantonment", "matirkata", "dohs"] },
  { name: "Farmgate", lat: 23.757, lon: 90.389, keywords: ["farmgate", "green road", "panthapath", "kawran bazar", "karwan"] },
];

export function resolveArea(
  lat: number,
  lon: number,
  addressText?: string
): { area: string; city: string } {
  const lower = (addressText || "").toLowerCase();

  // 1. Distance checks between Dhaka and Chattagram (Chandgaon office)
  const distToDhaka = haversineKm(lat, lon, 23.7937, 90.404);
  const distToCtg = haversineKm(lat, lon, 22.3811, 91.8482);

  const isDhaka = distToDhaka < distToCtg && (lower.includes("dhaka") || distToDhaka < 60);

  if (isDhaka) {
    for (const a of CANONICAL_DHAKA_AREAS) {
      if (a.keywords.some((k) => lower.includes(k))) {
        return { area: a.name, city: "Dhaka" };
      }
    }
    let closestDhaka = CANONICAL_DHAKA_AREAS[0];
    let minDist = Infinity;
    for (const a of CANONICAL_DHAKA_AREAS) {
      const d = haversineKm(lat, lon, a.lat, a.lon);
      if (d < minDist) {
        minDist = d;
        closestDhaka = a;
      }
    }
    return { area: closestDhaka.name, city: "Dhaka" };
  }

  // 2. Default: Chattagram (Business office in Chandgaon)
  for (const a of CANONICAL_CHATTOGRAM_AREAS) {
    if (a.keywords.some((k) => lower.includes(k))) {
      return { area: a.name, city: "Chattagram" };
    }
  }
  let closestCtg = CANONICAL_CHATTOGRAM_AREAS[0]; // Chandgaon
  let minDist = Infinity;
  for (const a of CANONICAL_CHATTOGRAM_AREAS) {
    const d = haversineKm(lat, lon, a.lat, a.lon);
    if (d < minDist) {
      minDist = d;
      closestCtg = a;
    }
  }
  return { area: closestCtg.name, city: "Chattagram" };
}

// Backward-compatible alias
export function resolveDhakaArea(lat: number, lon: number, addressText?: string): string {
  return resolveArea(lat, lon, addressText).area;
}

export async function reverseGeocode(lat: number, lon: number): Promise<GeocodeResult> {
  const mapsUrl = `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&zoom=18`,
      {
        headers: {
          "User-Agent": "MeatBondFoodsMart/1.0 (contact@meatbond.com)",
          "Accept-Language": "en",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const fullText = [
        addr.road,
        addr.quarter,
        addr.suburb,
        addr.residential,
        addr.neighbourhood,
        addr.city,
        addr.state_district,
        data.display_name,
      ]
        .filter(Boolean)
        .join(" ");

      const resolved = resolveArea(lat, lon, fullText);

      // Build clean line1
      const streetParts: string[] = [];
      if (addr.house_number) streetParts.push(`House ${addr.house_number}`);
      if (addr.building) streetParts.push(addr.building);
      if (addr.road) streetParts.push(addr.road);
      else if (addr.residential) streetParts.push(addr.residential);
      else if (addr.quarter) streetParts.push(addr.quarter);
      else if (addr.neighbourhood) streetParts.push(addr.neighbourhood);

      let line1 = streetParts.join(", ").trim();
      if (!line1) {
        line1 = `Near ${resolved.area}`;
      }

      let detectedCity = resolved.city;
      const rawCity = addr.city || addr.town || "";
      if (rawCity.toLowerCase().includes("chatt") || rawCity.toLowerCase().includes("chitt")) {
        detectedCity = "Chattagram";
      } else if (rawCity.toLowerCase().includes("dhaka")) {
        detectedCity = "Dhaka";
      }

      const distToChandgaon = haversineKm(lat, lon, 22.3811, 91.8482);
      const distanceKm = Math.round(distToChandgaon * 10) / 10;
      const isDeliverable = isChattagram(detectedCity, distanceKm);
      const isFreeDelivery = isDeliverable && distanceKm <= 7;
      const deliveryMessage = isDeliverable
        ? (isFreeDelivery ? "Free delivery within 7 km" : "Delivery: ৳80")
        : "Delivery is currently unavailable outside Chattagram";

      return {
        line1,
        area: resolved.area,
        city: detectedCity,
        latitude: lat,
        longitude: lon,
        mapsUrl,
        distanceKm,
        isFreeDelivery,
        isDeliverable,
        deliveryMessage,
        rawAddress: data.display_name || undefined,
      };
    }
  } catch (err) {
    console.warn("Reverse geocode OSM lookup failed, using fallback:", err);
  }

  const fallback = resolveArea(lat, lon, "");
  const distToChandgaonFallback = haversineKm(lat, lon, 22.3811, 91.8482);
  const fallbackDistanceKm = Math.round(distToChandgaonFallback * 10) / 10;
  const isFallbackDeliverable = isChattagram(fallback.city, fallbackDistanceKm);
  const isFallbackFree = isFallbackDeliverable && fallbackDistanceKm <= 7;
  const fallbackDeliveryMessage = isFallbackDeliverable
    ? (isFallbackFree ? "Free delivery within 7 km" : "Delivery: ৳80")
    : "Delivery is currently unavailable outside Chattagram";
  return {
    line1: `Location near ${fallback.area}`,
    area: fallback.area,
    city: fallback.city,
    latitude: lat,
    longitude: lon,
    mapsUrl,
    distanceKm: fallbackDistanceKm,
    isFreeDelivery: isFallbackFree,
    isDeliverable: isFallbackDeliverable,
    deliveryMessage: fallbackDeliveryMessage,
  };
}
