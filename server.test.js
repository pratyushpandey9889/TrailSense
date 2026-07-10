const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createServer } = require("../server");

const dbPath = path.join(__dirname, ".tmp-server-test.json");
if (fs.existsSync(dbPath)) fs.rmSync(dbPath);

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function json(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await response.json();
  return { response, body };
}

async function run() {
  const server = createServer({ dbPath });
  const baseUrl = await listen(server);

  try {
    const register = await json(`${baseUrl}/api/auth/register`, {
      method: "POST",
      body: JSON.stringify({ email: "traveler@example.com", password: "trail-pass-123" })
    });
    assert.strictEqual(register.response.status, 201);
    assert(register.body.token);

    const duplicate = await json(`${baseUrl}/api/auth/register`, {
      method: "POST",
      body: JSON.stringify({ email: "traveler@example.com", password: "trail-pass-123" })
    });
    assert.strictEqual(duplicate.response.status, 409);

    const invalidGenerate = await json(`${baseUrl}/api/trips/generate`, {
      method: "POST",
      body: JSON.stringify({
        origin: "Bengaluru",
        destination: "Goa",
        startDate: "2026-07-20",
        endDate: "2026-07-20",
        groupSize: 2,
        pace: "mixed",
        notes: ""
      })
    });
    assert.strictEqual(invalidGenerate.response.status, 400);

    const generated = await json(`${baseUrl}/api/trips/generate`, {
      method: "POST",
      body: JSON.stringify({
        origin: "Bengaluru",
        destination: "Goa",
        startDate: "2026-07-18",
        endDate: "2026-07-24",
        groupSize: 2,
        pace: "adventure-heavy",
        notes: "Traveling with a child."
      })
    });
    assert.strictEqual(generated.response.status, 200);
    assert(generated.body.alerts.some((alert) => alert.rule_key === "monsoon_window_overlap"));

    const noAuthSave = await json(`${baseUrl}/api/trips`, {
      method: "POST",
      body: JSON.stringify({ itinerary: generated.body })
    });
    assert.strictEqual(noAuthSave.response.status, 401);

    const saved = await json(`${baseUrl}/api/trips`, {
      method: "POST",
      headers: { authorization: `Bearer ${register.body.token}` },
      body: JSON.stringify({ itinerary: generated.body })
    });
    assert.strictEqual(saved.response.status, 201);
    assert(saved.body.trip.id);

    const list = await json(`${baseUrl}/api/trips`, {
      headers: { authorization: `Bearer ${register.body.token}` }
    });
    assert.strictEqual(list.response.status, 200);
    assert.strictEqual(list.body.trips.length, 1);

    const share = await json(`${baseUrl}/api/trips/${saved.body.trip.id}/share`, {
      method: "POST",
      headers: { authorization: `Bearer ${register.body.token}` }
    });
    assert.strictEqual(share.response.status, 201);
    assert(share.body.token);

    const shared = await json(`${baseUrl}/api/share/${share.body.token}`);
    assert.strictEqual(shared.response.status, 200);
    assert.strictEqual(shared.body.itinerary.trip.destination_name, "Goa");

    const pdf = await fetch(`${baseUrl}/api/trips/${saved.body.trip.id}/export.pdf`, {
      headers: { authorization: `Bearer ${register.body.token}` }
    });
    assert.strictEqual(pdf.status, 200);
    const header = Buffer.from(await pdf.arrayBuffer()).toString("utf8", 0, 8);
    assert(header.startsWith("%PDF-"));
  } finally {
    await close(server);
    if (fs.existsSync(dbPath)) fs.rmSync(dbPath);
  }
}

run()
  .then(() => console.log("All TrailSense server tests passed."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

