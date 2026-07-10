# TrailSense

TrailSense is a local-first prototype of a constraint-aware trip planning agent.

The current slice includes:

- Required trip input validation.
- Destination matching for Sikkim/Darjeeling and Goa.
- Data-driven constraint rules for mountain and coastal profiles.
- Pace-aware itinerary generation.
- Traveler-note sensitivity for altitude, mobility, children, and elderly travelers.
- Entry requirements with lead-time urgency.
- Source-backed and model-inferred confidence badges.
- Demo live-condition fallback data.
- Account registration/login with securely hashed passwords.
- Authenticated saved trips and public read-only share links.
- PDF export generated from itinerary data.

## Run

Best experience:

```powershell
node server.js
```

Then open `http://127.0.0.1:8787`.

The direct file version still works by opening `index.html`, but account saving, server share links, and PDF downloads require the local server.

## Tests

Use the bundled Node runtime from Codex, or any local Node installation:

```powershell
node tests/engine.test.js
node tests/server.test.js
```
