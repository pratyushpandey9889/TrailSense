const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const seed = require("./src/data");
const engine = require("./src/engine");

const ROOT_DIR = __dirname;
const DEFAULT_DB_PATH = path.join(ROOT_DIR, ".trailsense-data", "trailsense.json");
const DEFAULT_PORT = Number(process.env.PORT || 8787);
const TOKEN_SECRET = process.env.TRAILSENSE_TOKEN_SECRET || "trailsense-local-dev-secret";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf"
};

function emptyDb() {
  return {
    users: [],
    trips: [],
    shareLinks: []
  };
}

function ensureDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(emptyDb(), null, 2));
  }
}

function readDb(dbPath) {
  ensureDb(dbPath);
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

function writeDb(dbPath, db) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body)
    ? body
    : JSON.stringify(body);
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    ...headers
  });
  res.end(payload);
}

function sendJson(res, status, body) {
  send(res, status, body, { "Content-Type": "application/json; charset=utf-8" });
}

function sendError(res, status, message) {
  sendJson(res, status, { ok: false, error: message });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlJson(value) {
  return base64Url(JSON.stringify(value));
}

function sign(value) {
  return crypto.createHmac("sha256", TOKEN_SECRET).update(value).digest("base64url");
}

function issueToken(user) {
  const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const payload = base64UrlJson({
    sub: user.id,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12
  });
  const signature = sign(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = sign(`${header}.${payload}`);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsed.exp && parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch (error) {
    return null;
  }
}

function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  const computed = crypto.scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return expected.length === computed.length && crypto.timingSafeEqual(expected, computed);
}

function getBearer(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function requireUser(req, res, db) {
  const payload = verifyToken(getBearer(req));
  if (!payload) {
    sendError(res, 401, "Authentication required.");
    return null;
  }
  const user = db.users.find((item) => item.id === payload.sub);
  if (!user) {
    sendError(res, 401, "Authentication required.");
    return null;
  }
  return user;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function publicTrip(trip) {
  return {
    id: trip.id,
    name: trip.name,
    destination_name: trip.destination_name,
    profile_type: trip.profile_type,
    saved_at: trip.saved_at,
    updated_at: trip.updated_at,
    itinerary: trip.itinerary
  };
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function itineraryToLines(itinerary) {
  const lines = [];
  const trip = itinerary.trip || {};
  lines.push("TrailSense itinerary");
  lines.push(`${trip.origin || ""} to ${trip.destination_name || trip.destination || ""}`);
  lines.push(`${trip.startDate || ""} to ${trip.endDate || ""} | ${trip.pace || ""} pace | Group ${trip.groupSize || ""}`);
  lines.push("");

  if (Array.isArray(itinerary.entryRequirements) && itinerary.entryRequirements.length) {
    lines.push("Action required before you go");
    itinerary.entryRequirements.forEach((requirement) => {
      lines.push(`- ${requirement.name} (${requirement.requirement_type}): ${requirement.urgency}`);
      lines.push(`  ${requirement.notes}`);
      lines.push(`  Source: ${requirement.source_name} ${requirement.source_url}`);
    });
    lines.push("Rules can change. Verify requirements with official sources close to the travel date.");
    lines.push("");
  }

  if (Array.isArray(itinerary.alerts) && itinerary.alerts.length) {
    lines.push("Constraint alerts");
    itinerary.alerts.forEach((alert) => {
      lines.push(`- [${alert.severity}] ${alert.message}`);
      lines.push(`  Fix: ${alert.suggested_fix}`);
      lines.push(`  Confidence: ${alert.claim ? alert.claim.confidence_level : "model-inferred - verify locally"}`);
    });
    lines.push("");
  }

  if (Array.isArray(itinerary.liveWarnings) && itinerary.liveWarnings.length) {
    lines.push("Live condition checks");
    itinerary.liveWarnings.forEach((warning) => {
      lines.push(`- ${warning.check_type}${warning.stale ? " (stale)" : ""}: ${warning.synthesized_warning}`);
      lines.push(`  Source: ${warning.source_name} ${warning.source_url}`);
    });
    lines.push("");
  }

  lines.push("Day-by-day itinerary");
  (itinerary.days || []).forEach((day) => {
    lines.push(`Day ${day.day_number} - ${day.date} - ${day.location}${day.is_rest_day ? " (rest day)" : ""}`);
    lines.push(day.summary || "");
    if (day.rest_reason) lines.push(`Rest reason: ${day.rest_reason}`);
    (day.alerts || []).forEach((alert) => lines.push(`Alert: ${alert.message}`));
    (day.activities || []).forEach((activity) => {
      lines.push(`- ${activity.title}: ${activity.description}`);
      if (activity.claim) {
        const source = activity.claim.source_name ? ` | Source: ${activity.claim.source_name}` : "";
        lines.push(`  Confidence: ${activity.claim.confidence_level}${source}`);
      }
    });
    lines.push("");
  });

  return lines;
}

function wrapPdfLine(line, maxLength = 92) {
  const words = String(line || "").split(/\s+/);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  lines.push(current);
  return lines;
}

function pdfEscape(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildPdf(itinerary) {
  const wrapped = itineraryToLines(itinerary).flatMap((line) => {
    if (!line) return [""];
    return wrapPdfLine(line);
  });
  const linesPerPage = 48;
  const pages = [];
  for (let i = 0; i < wrapped.length; i += linesPerPage) {
    pages.push(wrapped.slice(i, i + linesPerPage));
  }

  const objects = [];
  const pageObjectIds = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  pages.forEach((pageLines, index) => {
    const contentId = 4 + index * 2;
    const pageId = 5 + index * 2;
    const content = [
      "BT",
      "/F1 10 Tf",
      "50 790 Td",
      "14 TL",
      ...pageLines.map((line) => `(${pdfEscape(line)}) Tj T*`),
      "ET"
    ].join("\n");
    objects[contentId] = `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    pageObjectIds.push(pageId);
  });

  objects[2] = `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "utf8");
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

function serveStatic(req, res, pathname) {
  let requestPath = pathname.replace(/^\//, "");
  if (pathname === "/" || pathname === "/index.html" || /^\/share\/[^/]+$/.test(pathname)) {
    requestPath = "index.html";
  } else if (pathname.startsWith("/share/src/")) {
    requestPath = pathname.replace(/^\/share\//, "");
  }
  const filePath = path.normalize(path.join(ROOT_DIR, requestPath));
  if (!filePath.startsWith(ROOT_DIR)) {
    sendError(res, 403, "Forbidden.");
    return true;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }
  const ext = path.extname(filePath);
  send(res, 200, fs.readFileSync(filePath), { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
  return true;
}

function createServer(options = {}) {
  const dbPath = options.dbPath || DEFAULT_DB_PATH;

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    const pathname = decodeURIComponent(url.pathname);

    if (req.method === "OPTIONS") {
      send(res, 204, "");
      return;
    }

    try {
      if (req.method === "POST" && pathname === "/api/auth/register") {
        const body = await parseBody(req);
        const email = normalizeEmail(body.email);
        const password = String(body.password || "");
        if (!email || !email.includes("@")) {
          sendError(res, 400, "A valid email is required.");
          return;
        }
        if (password.length < 8) {
          sendError(res, 400, "Password must be at least 8 characters.");
          return;
        }
        const db = readDb(dbPath);
        if (db.users.some((user) => user.email === email)) {
          sendError(res, 409, "Email is already registered.");
          return;
        }
        const user = {
          id: crypto.randomUUID(),
          email,
          password_hash: passwordHash(password),
          created_at: new Date().toISOString()
        };
        db.users.push(user);
        writeDb(dbPath, db);
        sendJson(res, 201, { ok: true, user: publicUser(user), token: issueToken(user) });
        return;
      }

      if (req.method === "POST" && pathname === "/api/auth/login") {
        const body = await parseBody(req);
        const email = normalizeEmail(body.email);
        const db = readDb(dbPath);
        const user = db.users.find((item) => item.email === email);
        if (!user || !verifyPassword(String(body.password || ""), user.password_hash)) {
          sendError(res, 401, "Invalid email or password.");
          return;
        }
        sendJson(res, 200, { ok: true, user: publicUser(user), token: issueToken(user) });
        return;
      }

      if (req.method === "POST" && pathname === "/api/trips/generate") {
        const body = await parseBody(req);
        const result = engine.generateItinerary(body, seed);
        sendJson(res, result.ok ? 200 : 400, result);
        return;
      }

      if (req.method === "GET" && pathname === "/api/trips") {
        const db = readDb(dbPath);
        const user = requireUser(req, res, db);
        if (!user) return;
        const trips = db.trips
          .filter((trip) => trip.user_id === user.id)
          .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
          .map(publicTrip);
        sendJson(res, 200, { ok: true, trips });
        return;
      }

      if (req.method === "POST" && pathname === "/api/trips") {
        const db = readDb(dbPath);
        const user = requireUser(req, res, db);
        if (!user) return;
        const body = await parseBody(req);
        const itinerary = body.itinerary;
        if (!itinerary || !itinerary.ok || !itinerary.trip) {
          sendError(res, 400, "A generated itinerary is required.");
          return;
        }
        const now = new Date().toISOString();
        const trip = {
          id: crypto.randomUUID(),
          user_id: user.id,
          name: itinerary.trip.destination_name || itinerary.trip.destination,
          destination_name: itinerary.trip.destination_name,
          profile_type: itinerary.trip.profile_type,
          itinerary,
          saved_at: now,
          updated_at: now
        };
        db.trips.push(trip);
        writeDb(dbPath, db);
        sendJson(res, 201, { ok: true, trip: publicTrip(trip) });
        return;
      }

      const tripMatch = pathname.match(/^\/api\/trips\/([^/]+)$/);
      if (req.method === "GET" && tripMatch) {
        const db = readDb(dbPath);
        const user = requireUser(req, res, db);
        if (!user) return;
        const trip = db.trips.find((item) => item.id === tripMatch[1] && item.user_id === user.id);
        if (!trip) {
          sendError(res, 404, "Trip not found.");
          return;
        }
        sendJson(res, 200, { ok: true, trip: publicTrip(trip) });
        return;
      }

      const shareMatch = pathname.match(/^\/api\/trips\/([^/]+)\/share$/);
      if (req.method === "POST" && shareMatch) {
        const db = readDb(dbPath);
        const user = requireUser(req, res, db);
        if (!user) return;
        const trip = db.trips.find((item) => item.id === shareMatch[1] && item.user_id === user.id);
        if (!trip) {
          sendError(res, 404, "Trip not found.");
          return;
        }
        const token = crypto.randomBytes(24).toString("base64url");
        const link = {
          id: crypto.randomUUID(),
          trip_id: trip.id,
          token_hash: tokenHash(token),
          created_at: new Date().toISOString(),
          revoked_at: null
        };
        db.shareLinks.push(link);
        writeDb(dbPath, db);
        sendJson(res, 201, { ok: true, url: `/share/${token}`, token });
        return;
      }

      const exportMatch = pathname.match(/^\/api\/trips\/([^/]+)\/export\.pdf$/);
      if (req.method === "GET" && exportMatch) {
        const db = readDb(dbPath);
        const user = requireUser(req, res, db);
        if (!user) return;
        const trip = db.trips.find((item) => item.id === exportMatch[1] && item.user_id === user.id);
        if (!trip) {
          sendError(res, 404, "Trip not found.");
          return;
        }
        send(res, 200, buildPdf(trip.itinerary), {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="trailsense-${trip.id}.pdf"`
        });
        return;
      }

      if (req.method === "POST" && pathname === "/api/export.pdf") {
        const body = await parseBody(req);
        const itinerary = body.itinerary;
        if (!itinerary || !itinerary.ok || !itinerary.trip) {
          sendError(res, 400, "A generated itinerary is required.");
          return;
        }
        send(res, 200, buildPdf(itinerary), {
          "Content-Type": "application/pdf",
          "Content-Disposition": "attachment; filename=\"trailsense-itinerary.pdf\""
        });
        return;
      }

      const publicShareMatch = pathname.match(/^\/api\/share\/([^/]+)$/);
      if (req.method === "GET" && publicShareMatch) {
        const token = publicShareMatch[1];
        const db = readDb(dbPath);
        const link = db.shareLinks.find((item) => item.token_hash === tokenHash(token) && !item.revoked_at);
        if (!link) {
          sendError(res, 404, "Share link not found.");
          return;
        }
        const trip = db.trips.find((item) => item.id === link.trip_id);
        if (!trip) {
          sendError(res, 404, "Shared trip not found.");
          return;
        }
        sendJson(res, 200, { ok: true, trip: publicTrip(trip), itinerary: trip.itinerary });
        return;
      }

      if (req.method === "GET" && serveStatic(req, res, pathname)) {
        return;
      }

      sendError(res, 404, "Not found.");
    } catch (error) {
      sendError(res, 500, error.message || "Server error.");
    }
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(DEFAULT_PORT, "127.0.0.1", () => {
    console.log(`TrailSense is running at http://127.0.0.1:${DEFAULT_PORT}`);
  });
}

module.exports = {
  createServer,
  buildPdf,
  itineraryToLines,
  readDb,
  writeDb,
  emptyDb
};
