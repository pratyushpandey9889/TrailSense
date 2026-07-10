(function appFactory() {
  const seed = window.TRAILSENSE_SEED;
  const engine = window.TrailSenseEngine;
  const form = document.getElementById("trip-form");
  const errorsEl = document.getElementById("form-errors");
  const itineraryPanel = document.getElementById("itinerary-panel");
  const profileIndicator = document.getElementById("profile-indicator");
  const authStatus = document.getElementById("auth-status");
  const authGrid = document.getElementById("auth-grid");
  const loginButton = document.getElementById("login-button");
  const registerButton = document.getElementById("register-button");
  const logoutButton = document.getElementById("logout-button");
  const savedTripsEl = document.getElementById("saved-trips");

  const apiEnabled = window.location.protocol !== "file:";
  let authState = loadAuthState();
  let currentItinerary = null;
  let currentSavedTripId = null;
  let currentReadOnly = false;

  function htmlEscape(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function loadAuthState() {
    if (!apiEnabled) return null;
    try {
      return JSON.parse(localStorage.getItem("trailsense.auth") || "null");
    } catch (error) {
      return null;
    }
  }

  function storeAuthState(nextState) {
    authState = nextState;
    if (nextState) {
      localStorage.setItem("trailsense.auth", JSON.stringify(nextState));
    } else {
      localStorage.removeItem("trailsense.auth");
    }
    renderAuthState();
  }

  async function apiRequest(path, options) {
    if (!apiEnabled) throw new Error("Local server is not available.");
    const request = options || {};
    const headers = { ...(request.headers || {}) };
    if (request.body) headers["content-type"] = "application/json";
    if (authState && authState.token) headers.authorization = `Bearer ${authState.token}`;

    const response = await fetch(path, {
      method: request.method || "GET",
      headers,
      body: request.body ? JSON.stringify(request.body) : undefined
    });

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/pdf")) {
      const blob = await response.blob();
      if (!response.ok) throw new Error("PDF export failed.");
      return { blob, response };
    }

    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Request failed.");
    return body;
  }

  function setDefaultDates() {
    const start = new Date();
    start.setDate(start.getDate() + 30);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    document.getElementById("startDate").value = engine.formatDate(start);
    document.getElementById("endDate").value = engine.formatDate(end);
  }

  function getFormInput() {
    const data = new FormData(form);
    return {
      origin: data.get("origin"),
      destination: data.get("destination"),
      startDate: data.get("startDate"),
      endDate: data.get("endDate"),
      groupSize: data.get("groupSize"),
      pace: data.get("pace"),
      notes: data.get("notes")
    };
  }

  function confidenceBadge(claim) {
    if (!claim) return "";
    const isSourceBacked = claim.confidence_level === engine.CONFIDENCE.SOURCE_BACKED;
    const source = claim.source_name
      ? `<a href="${htmlEscape(claim.source_url)}" target="_blank" rel="noreferrer">${htmlEscape(claim.source_name)}</a>`
      : "";
    return `
      <span class="confidence ${isSourceBacked ? "source-backed" : "model-inferred"}">
        <span>${htmlEscape(claim.confidence_level)}</span>
        ${source ? `<span class="source-link">${source}</span>` : ""}
      </span>
    `;
  }

  function severityClass(severity) {
    if (severity === "critical") return "critical";
    if (severity === "warning") return "warning";
    return "info";
  }

  function renderAlerts(alerts) {
    if (!alerts.length) {
      return `<p class="quiet-line">No specialized alerts fired for this trip.</p>`;
    }

    return alerts.map((alert) => `
      <article class="alert-card ${severityClass(alert.severity)}">
        <div>
          <p class="alert-label">${htmlEscape(alert.severity)} - ${htmlEscape(alert.rule_key)}</p>
          <h3>${htmlEscape(alert.message)}</h3>
          <p>${htmlEscape(alert.suggested_fix)}</p>
        </div>
        ${confidenceBadge(alert.claim)}
      </article>
    `).join("");
  }

  function renderEntryRequirements(requirements) {
    if (!requirements.length) return "";
    return `
      <section class="itinerary-section">
        <div class="section-heading">
          <p class="eyebrow">Action required before you go</p>
          <h2>Entry requirements</h2>
        </div>
        <div class="requirement-grid">
          ${requirements.map((requirement) => `
            <article class="requirement-card">
              <div>
                <p class="alert-label">${htmlEscape(requirement.requirement_type)}</p>
                <h3>${htmlEscape(requirement.name)}</h3>
                <p>${htmlEscape(requirement.notes)}</p>
              </div>
              <div class="requirement-meta">
                <span class="urgency">${htmlEscape(requirement.urgency)}</span>
                <span>By ${htmlEscape(requirement.latest_recommended_action_date)}</span>
              </div>
              ${confidenceBadge(requirement.claim)}
            </article>
          `).join("")}
        </div>
        <p class="disclaimer">Rules can change. Verify requirements with official sources close to the travel date.</p>
      </section>
    `;
  }

  function renderLiveWarnings(warnings) {
    if (!warnings.length) return "";
    return `
      <section class="itinerary-section">
        <div class="section-heading">
          <p class="eyebrow">Live condition layer</p>
          <h2>Weather and route checks</h2>
        </div>
        <div class="live-grid">
          ${warnings.map((warning) => `
            <article class="live-card ${warning.stale ? "stale" : ""}">
              <p class="alert-label">${htmlEscape(warning.check_type)}${warning.stale ? " - stale" : ""}</p>
              <h3>${htmlEscape(warning.synthesized_warning)}</h3>
              <p>Fetched ${htmlEscape(warning.fetched_at)}</p>
              ${confidenceBadge(warning.claim)}
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderDays(days) {
    return `
      <section class="itinerary-section">
        <div class="section-heading">
          <p class="eyebrow">Day by day</p>
          <h2>Itinerary</h2>
        </div>
        <div class="day-list">
          ${days.map((day) => `
            <article class="day-card ${day.is_rest_day ? "rest-day" : ""}">
              <div class="day-heading">
                <div>
                  <p class="alert-label">Day ${day.day_number} - ${htmlEscape(day.date)}</p>
                  <h3>${htmlEscape(day.location)}</h3>
                </div>
                <span class="metric">${day.metrics.daily_elevation_gain_m}m gain</span>
              </div>
              <p>${htmlEscape(day.summary)}</p>
              ${day.rest_reason ? `<p class="rest-reason">${htmlEscape(day.rest_reason)}</p>` : ""}
              ${day.alerts.length ? `<div class="day-alerts">${renderAlerts(day.alerts)}</div>` : ""}
              <div class="activity-list">
                ${day.activities.map((activity) => `
                  <div class="activity-row">
                    <div>
                      <h4>${htmlEscape(activity.title)}</h4>
                      <p>${htmlEscape(activity.description)}</p>
                    </div>
                    ${confidenceBadge(activity.claim)}
                  </div>
                `).join("")}
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderItinerary(result, savedTripId, options) {
    if (!result.ok) {
      errorsEl.innerHTML = result.errors.map((error) => `<p>${htmlEscape(error)}</p>`).join("");
      return;
    }

    const renderOptions = options || {};
    errorsEl.innerHTML = "";
    currentItinerary = result;
    currentSavedTripId = savedTripId || null;
    currentReadOnly = Boolean(renderOptions.readOnly);
    profileIndicator.textContent = `${result.trip.profile_type} profile`;
    itineraryPanel.className = "itinerary-panel";

    const flagText = result.trip.traveler_flags.length
      ? result.trip.traveler_flags.map((flag) => flag.replace(/_/g, " ")).join(", ")
      : "No sensitivity flags detected";
    const actionButtons = currentReadOnly
      ? `<button type="button" id="print-trip" class="secondary-button">Export PDF</button>`
      : `
          <button type="button" id="save-trip" class="secondary-button">Save</button>
          <button type="button" id="share-trip" class="secondary-button">Share link</button>
          <button type="button" id="print-trip" class="secondary-button">Export PDF</button>
        `;

    itineraryPanel.innerHTML = `
      <section class="summary-strip">
        <div>
          <p class="eyebrow">${currentReadOnly ? "Shared plan" : "Generated plan"}</p>
          <h2>${htmlEscape(result.trip.destination_name)}</h2>
          <p>${htmlEscape(result.trip.origin)} to ${htmlEscape(result.trip.destination_name)} - ${htmlEscape(result.trip.startDate)} to ${htmlEscape(result.trip.endDate)}</p>
        </div>
        <div class="summary-actions">${actionButtons}</div>
      </section>

      <section class="trip-facts">
        <span>Group ${result.trip.groupSize}</span>
        <span>${htmlEscape(result.trip.pace)} pace</span>
        <span>${htmlEscape(flagText)}</span>
      </section>

      <section class="itinerary-section">
        <div class="section-heading">
          <p class="eyebrow">Constraint engine</p>
          <h2>Alerts and fixes</h2>
        </div>
        <div class="alert-stack">${renderAlerts(result.alerts)}</div>
      </section>

      ${renderEntryRequirements(result.entryRequirements)}
      ${renderLiveWarnings(result.liveWarnings)}
      ${renderDays(result.days)}
    `;

    const saveButton = document.getElementById("save-trip");
    const shareButton = document.getElementById("share-trip");
    if (saveButton) saveButton.addEventListener("click", () => saveTrip());
    if (shareButton) shareButton.addEventListener("click", () => shareTrip());
    document.getElementById("print-trip").addEventListener("click", exportTrip);
  }

  async function saveTrip() {
    if (!currentItinerary) return null;
    if (apiEnabled) {
      if (!authState) {
        toast("Log in or create an account before saving.");
        return null;
      }
      try {
        const result = await apiRequest("/api/trips", {
          method: "POST",
          body: { itinerary: currentItinerary }
        });
        currentSavedTripId = result.trip.id;
        toast("Trip saved to your account.");
        await loadSavedTrips();
        return currentSavedTripId;
      } catch (error) {
        toast(error.message);
        return null;
      }
    }

    const saved = JSON.parse(localStorage.getItem("trailsense.savedTrips") || "[]");
    const id = `trip-${Date.now()}`;
    saved.unshift({
      id,
      name: currentItinerary.trip.destination_name,
      saved_at: new Date().toISOString(),
      itinerary: currentItinerary
    });
    localStorage.setItem("trailsense.savedTrips", JSON.stringify(saved.slice(0, 10)));
    currentSavedTripId = id;
    toast("Trip saved locally.");
    return id;
  }

  async function shareTrip() {
    if (!currentItinerary) return;
    if (apiEnabled) {
      if (!authState) {
        toast("Log in or create an account before sharing.");
        return;
      }
      const tripId = currentSavedTripId || await saveTrip();
      if (!tripId) return;
      try {
        const result = await apiRequest(`/api/trips/${encodeURIComponent(tripId)}/share`, { method: "POST" });
        copyText(new URL(result.url, window.location.href).href, "Share link copied.");
      } catch (error) {
        toast(error.message);
      }
      return;
    }

    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(`trailsense.share.${token}`, JSON.stringify(currentItinerary));
    const baseUrl = window.location.protocol === "file:"
      ? window.location.href.split("?")[0]
      : `${window.location.origin}${window.location.pathname}`;
    copyText(`${baseUrl}?share=${token}`, "Share link copied.");
  }

  async function exportTrip() {
    if (!currentItinerary) return;
    if (!apiEnabled) {
      window.print();
      return;
    }
    try {
      const result = await apiRequest("/api/export.pdf", {
        method: "POST",
        body: { itinerary: currentItinerary }
      });
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "trailsense-itinerary.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast("PDF exported.");
    } catch (error) {
      toast(error.message);
    }
  }

  function copyText(text, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast(successMessage)).catch(() => toast(text));
      return;
    }
    toast(text);
  }

  function toast(message) {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    document.body.appendChild(node);
    window.setTimeout(() => node.remove(), 2600);
  }

  async function loadShareIfPresent() {
    const params = new URLSearchParams(window.location.search);
    const queryToken = params.get("share");
    const pathMatch = window.location.pathname.match(/\/share\/([^/]+)$/);
    const serverToken = pathMatch ? pathMatch[1] : null;

    if (apiEnabled && serverToken) {
      try {
        const result = await apiRequest(`/api/share/${encodeURIComponent(serverToken)}`);
        renderItinerary(result.itinerary, null, { readOnly: true });
        return true;
      } catch (error) {
        toast(error.message);
        return false;
      }
    }

    if (!queryToken) return false;
    const stored = localStorage.getItem(`trailsense.share.${queryToken}`);
    if (!stored) return false;
    renderItinerary(JSON.parse(stored), null, { readOnly: true });
    return true;
  }

  function fillDemo(kind) {
    document.getElementById("origin").value = kind === "mountain" ? "Bengaluru" : "Mumbai";
    document.getElementById("destination").value = kind === "mountain" ? "Sikkim and Darjeeling" : "Goa";
    document.getElementById("groupSize").value = kind === "mountain" ? "4" : "2";
    document.querySelector(`input[name="pace"][value="${kind === "mountain" ? "adventure-heavy" : "mixed"}"]`).checked = true;
    document.getElementById("notes").value = kind === "mountain"
      ? "One traveler has altitude sensitivity and we are traveling with elderly parents."
      : "Traveling during monsoon with a child; prefer safer water plans.";

    const start = new Date();
    start.setMonth(kind === "mountain" ? 9 : 6);
    start.setDate(kind === "mountain" ? 12 : 18);
    const end = new Date(start);
    end.setDate(end.getDate() + (kind === "mountain" ? 6 : 5));
    document.getElementById("startDate").value = engine.formatDate(start);
    document.getElementById("endDate").value = engine.formatDate(end);
  }

  function updateProfileIndicator() {
    const destination = engine.matchDestination(document.getElementById("destination").value, seed);
    profileIndicator.textContent = destination ? `${destination.profile_type} profile` : "No specialized profile";
  }

  async function handleAuth(mode) {
    if (!apiEnabled) {
      toast("Start the local server to use accounts.");
      return;
    }
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    try {
      const result = await apiRequest(`/api/auth/${mode}`, {
        method: "POST",
        body: { email, password }
      });
      storeAuthState({ user: result.user, token: result.token });
      document.getElementById("auth-password").value = "";
      toast(mode === "login" ? "Logged in." : "Account created.");
      await loadSavedTrips();
    } catch (error) {
      toast(error.message);
    }
  }

  function renderAuthState() {
    if (!apiEnabled) {
      authStatus.textContent = "Open through the local server to enable account saving.";
      authGrid.style.display = "grid";
      loginButton.style.display = "inline-flex";
      registerButton.style.display = "inline-flex";
      logoutButton.style.display = "none";
      return;
    }

    if (authState && authState.user) {
      authStatus.textContent = `Signed in as ${authState.user.email}`;
      authGrid.style.display = "none";
      loginButton.style.display = "none";
      registerButton.style.display = "none";
      logoutButton.style.display = "inline-flex";
      return;
    }

    authStatus.textContent = "Log in to save trips, create share links, and retrieve plans.";
    authGrid.style.display = "grid";
    loginButton.style.display = "inline-flex";
    registerButton.style.display = "inline-flex";
    logoutButton.style.display = "none";
    savedTripsEl.innerHTML = "";
  }

  async function loadSavedTrips() {
    if (!apiEnabled || !authState) return;
    try {
      const result = await apiRequest("/api/trips");
      if (!result.trips.length) {
        savedTripsEl.innerHTML = `<p class="quiet-line">No saved trips yet.</p>`;
        return;
      }
      savedTripsEl.innerHTML = result.trips.map((trip) => `
        <button type="button" class="saved-trip-button" data-trip-id="${htmlEscape(trip.id)}">
          ${htmlEscape(trip.name)} - ${htmlEscape(trip.saved_at.slice(0, 10))}
        </button>
      `).join("");
      savedTripsEl.querySelectorAll("[data-trip-id]").forEach((button) => {
        button.addEventListener("click", () => {
          const trip = result.trips.find((item) => item.id === button.dataset.tripId);
          if (trip) renderItinerary(trip.itinerary, trip.id);
        });
      });
    } catch (error) {
      savedTripsEl.innerHTML = `<p class="quiet-line">${htmlEscape(error.message)}</p>`;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = getFormInput();
    try {
      const result = apiEnabled
        ? await apiRequest("/api/trips/generate", { method: "POST", body: input })
        : engine.generateItinerary(input, seed);
      renderItinerary(result);
    } catch (error) {
      errorsEl.innerHTML = `<p>${htmlEscape(error.message)}</p>`;
    }
  });

  loginButton.addEventListener("click", () => handleAuth("login"));
  registerButton.addEventListener("click", () => handleAuth("register"));
  logoutButton.addEventListener("click", () => {
    storeAuthState(null);
    toast("Logged out.");
  });

  document.getElementById("demo-mountain").addEventListener("click", () => {
    fillDemo("mountain");
    updateProfileIndicator();
  });

  document.getElementById("demo-coastal").addEventListener("click", () => {
    fillDemo("coastal");
    updateProfileIndicator();
  });

  document.getElementById("destination").addEventListener("input", updateProfileIndicator);

  async function init() {
    renderAuthState();
    if (authState) await loadSavedTrips();
    setDefaultDates();
    const loadedShare = await loadShareIfPresent();
    if (!loadedShare) {
      fillDemo("mountain");
      updateProfileIndicator();
    }
  }

  init();
})();
