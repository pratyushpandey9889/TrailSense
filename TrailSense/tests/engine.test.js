const assert = require("assert");
const seed = require("../src/data");
const engine = require("../src/engine");

function generate(overrides = {}) {
  return engine.generateItinerary({
    origin: "Bengaluru",
    destination: "Sikkim and Darjeeling",
    startDate: "2026-10-01",
    endDate: "2026-10-07",
    groupSize: 3,
    pace: "mixed",
    notes: "",
    ...overrides
  }, seed, {
    today: new Date(2026, 6, 10),
    now: new Date("2026-07-10T12:00:00+05:30")
  });
}

function testDateValidation() {
  const result = generate({ startDate: "2026-10-07", endDate: "2026-10-07" });
  assert.strictEqual(result.ok, false);
  assert(result.errors.includes("End date must be after the start date."));
}

function testMountainRulesUseTravelerNotes() {
  const result = generate({
    notes: "Altitude sensitivity and traveling with elderly parents."
  });
  assert.strictEqual(result.ok, true);
  const elevationAlerts = result.alerts.filter((alert) => alert.rule_key === "daily_elevation_gain_limit");
  assert(elevationAlerts.length >= 1);
  assert(elevationAlerts.some((alert) => alert.severity === "critical"));
  assert(result.days.some((day) => day.is_rest_day && day.rest_reason));
}

function testCoastalRulesUseSameEngine() {
  const result = generate({
    destination: "Goa",
    startDate: "2026-07-18",
    endDate: "2026-07-24",
    pace: "adventure-heavy",
    notes: "Traveling with a child."
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.trip.profile_type, "coastal");
  assert(result.alerts.some((alert) => alert.rule_key === "monsoon_window_overlap"));
  assert(result.alerts.some((alert) => alert.rule_key === "seasonal_marine_activity_closure"));
}

function testUnknownDestinationStillGenerates() {
  const result = generate({
    destination: "Imaginary Valley",
    startDate: "2026-11-01",
    endDate: "2026-11-04"
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.trip.profile_type, "unknown");
  assert(result.alerts.some((alert) => alert.rule_key === "unknown_destination_profile"));
}

function testEntryRequirementUrgency() {
  const result = generate({
    startDate: "2026-07-15",
    endDate: "2026-07-20"
  });
  assert.strictEqual(result.ok, true);
  assert(result.entryRequirements.some((requirement) => requirement.urgency === "act immediately"));
}

function testActivityClaimsAreTagged() {
  const result = generate();
  assert.strictEqual(result.ok, true);
  const claims = result.days.flatMap((day) => day.activities.map((activity) => activity.claim));
  assert(claims.length > 0);
  claims.forEach((claim) => {
    assert([engine.CONFIDENCE.SOURCE_BACKED, engine.CONFIDENCE.MODEL_INFERRED].includes(claim.confidence_level));
  });
}

[
  testDateValidation,
  testMountainRulesUseTravelerNotes,
  testCoastalRulesUseSameEngine,
  testUnknownDestinationStillGenerates,
  testEntryRequirementUrgency,
  testActivityClaimsAreTagged
].forEach((test) => test());

console.log("All TrailSense engine tests passed.");

