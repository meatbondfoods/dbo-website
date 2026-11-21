import { NextRequest } from "next/server";
import { reverseGeocode } from "@/lib/geocode";
import { apiError, json } from "@/lib/http";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const latStr = url.searchParams.get("lat");
  const lonStr = url.searchParams.get("lon");

  if (!latStr || !lonStr) {
    return apiError("Missing lat or lon query parameter", 400);
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
