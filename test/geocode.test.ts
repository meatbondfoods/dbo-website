import test from "node:test";
import assert from "node:assert/strict";
import { isChattagram, resolveArea, resolveDhakaArea, reverseGeocode } from "../src/lib/geocode.ts";

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

test("isChattagram validates delivery zone", () => {
  assert.equal(isChattagram("Chattagram", 5), true);
  assert.equal(isChattagram("Chittagong", 12), true);
  assert.equal(isChattagram("Dhaka", 210), false);
  assert.equal(isChattagram("Chattagram", 50), false); // beyond 35 km radius
  assert.equal(isChattagram("Sylhet", 280), false);
});

test("reverseGeocode formats mapsUrl and returns area, city, and deliverability", async () => {
  const res = await reverseGeocode(22.3811, 91.8482);
  assert.ok(res.area);
  assert.ok(res.line1);
  assert.equal(res.city, "Chattagram");
  assert.equal(res.isDeliverable, true);
  assert.equal(res.isFreeDelivery, true);
  assert.ok(res.mapsUrl.includes("22.3811"));
  assert.ok(res.mapsUrl.includes("91.8482"));

  // Dhaka coordinates (e.g. Rampura)
  const dhakaRes = await reverseGeocode(23.7622, 90.4318);
  assert.equal(dhakaRes.city, "Dhaka");
  assert.equal(dhakaRes.isDeliverable, false);
  assert.equal(dhakaRes.isFreeDelivery, false);
  assert.ok(dhakaRes.deliveryMessage?.includes("not available"));
});
