import { NextRequest } from "next/server";
import { reverseGeocode, CHATTOGRAM_CENTER } from "@/lib/geocode";
import { apiError, json } from "@/lib/http";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  let latStr = url.searchParams.get("lat");
  let lonStr = url.searchParams.get("lon");

  // If lat or lon is missing, fallback to Vercel IP location headers or Chattagram center
  if (!latStr || !lonStr) {
    const vLat = req.headers.get("x-vercel-ip-latitude");
    const vLon = req.headers.get("x-vercel-ip-longitude");
    if (vLat && vLon) {
      latStr = vLat;
      lonStr = vLon;
    } else {
      latStr = String(CHATTOGRAM_CENTER.lat);
      lonStr = String(CHATTOGRAM_CENTER.lon);
    }
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (isNaN(lat) || isNaN(lon)) {
    return apiError("Invalid lat or lon coordinates", 400);
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return apiError("Coordinates out of bounds", 400);
  }

  try {
    const result = await reverseGeocode(lat, lon);
    return json({ success: true, ...result });
  } catch (err) {
    console.error("Geocoding failed:", err);
    return json(
      {
        success: false,
        error: "Could not reverse geocode location",
        latitude: lat,
        longitude: lon,
        mapsUrl: `https://www.google.com/maps?q=${lat},${lon}`,
      },
      500
    );
  }
}
