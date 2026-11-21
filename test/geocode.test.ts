import test from "node:test";
import assert from "node:assert/strict";
import { resolveArea, resolveDhakaArea, reverseGeocode } from "../src/lib/geocode.ts";

test("resolveArea matches Chattagram office and areas", () => {
  // Chandgaon office location
  const chandgaon = resolveArea(22.3811, 91.8482, "Chandgaon Thana, Chattagram");
  assert.equal(chandgaon.area, "Chandgaon");
  assert.equal(chandgaon.city, "Chattagram");

  // Agrabad
  const agrabad = resolveArea(22.3255, 91.812, "Agrabad Commercial Area");
  assert.equal(agrabad.area, "Agrabad");
  assert.equal(agrabad.city, "Chattagram");

  // GEC Circle
  const gec = resolveArea(22.3595, 91.8215, "GEC Circle, Nasirabad");
  assert.equal(gec.area, "GEC Circle");
  assert.equal(gec.city, "Chattagram");
});

test("resolveDhakaArea matches known Dhaka areas from coordinates and text", () => {
  assert.equal(resolveDhakaArea(23.7937, 90.404, "Banani Road 11, Dhaka"), "Banani");
  assert.equal(resolveDhakaArea(23.7925, 90.4167, "Gulshan-2 Circle, Dhaka"), "Gulshan");
  assert.equal(resolveDhakaArea(23.8759, 90.3795, "Sector 12, Uttara, Dhaka"), "Uttara");
});

test("reverseGeocode formats mapsUrl and returns area and city", async () => {
  const res = await reverseGeocode(22.3811, 91.8482);
  assert.ok(res.area);
  assert.ok(res.line1);
  assert.equal(res.city, "Chattagram");
  assert.ok(res.mapsUrl.includes("22.3811"));
  assert.ok(res.mapsUrl.includes("91.8482"));
});
