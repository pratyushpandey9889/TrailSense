(function engineFactory(root) {
  const CONFIDENCE = {
    SOURCE_BACKED: "source-backed",
    MODEL_INFERRED: "model-inferred - verify locally"
  };

  const PACE_SETTINGS = {
    relaxed: { activitiesPerDay: 2, elevationMultiplier: 0.8, restEvery: 4 },
    mixed: { activitiesPerDay: 3, elevationMultiplier: 1, restEvery: 0 },
    "adventure-heavy": { activitiesPerDay: 4, elevationMultiplier: 1.25, restEvery: 0 }
  };

  const SEVERITY_RANK = { info: 0, warning: 1, critical: 2 };
  const SEVERITY_BY_RANK = ["info", "warning", "critical"];

  function parseDate(value) {
    if (!value) return null;
    const parts = String(value).split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function addDays(date, days) {
    const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  function diffDays(start, end) {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((end.getTime() - start.getTime()) / msPerDay);
  }

  function validateTripInput(input) {
    const errors = [];
    if (!input.origin || !input.origin.trim()) errors.push("Origin is required.");
    if (!input.destination || !input.destination.trim()) errors.push("Destination is required.");
    if (!input.startDate) errors.push("Start date is required.");
    if (!input.endDate) errors.push("End date is required.");

    const start = parseDate(input.startDate);
    const end = parseDate(input.endDate);
    if (input.startDate && !start) errors.push("Start date is invalid.");
    if (input.endDate && !end) errors.push("End date is invalid.");
    if (start && end && diffDays(start, end) <= 0) {
      errors.push("End date must be after the start date.");
    }

    const groupSize = Number(input.groupSize);
    if (!Number.isFinite(groupSize) || groupSize < 1) {
      errors.push("Group size must be at least 1.");
    }

    if (!PACE_SETTINGS[input.pace]) {
      errors.push("Choose a valid pace.");
    }

    return errors;
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function matchDestination(destinationInput, seed) {
    const normalized = normalizeText(destinationInput);
    return seed.destinations.find((destination) => {
      const names = [destination.name, destination.region, destination.country].concat(destination.aliases || []);
      return names.some((name) => normalized.includes(normalizeText(name)));
    }) || null;
  }

  function extractTravelerFlags(notes) {
    const text = normalizeText(notes);
    const flags = [];
    const checks = [
      { flag: "altitude_sensitivity", pattern: /(altitude|breath|acclimati|mountain sickness|ams)/ },
      { flag: "mobility_concern", pattern: /(mobility|wheelchair|knee|walking|slow walker|limited movement)/ },
      { flag: "traveling_with_children", pattern: /(child|children|kid|kids|toddler|baby)/ },
      { flag: "traveling_with_elderly", pattern: /(elderly|senior|older parent|aged parent|grandparent)/ }
    ];

    checks.forEach((check) => {
      if (check.pattern.test(text)) flags.push(check.flag);
    });

    return flags;
  }

  function claim(text, confidenceLevel, source) {
    return {
      id: `claim-${Math.random().toString(36).slice(2, 10)}`,
      text,
      confidence_level: confidenceLevel,
      source_name: source ? source.source_name : null,
      source_url: source ? source.source_url : null,
      source_type: source ? source.source_type || "knowledge_chunk" : "model"
    };
  }

  function retrieveChunkForActivity(activity, destination, seed) {
    const tags = activity.tags || [];
    return seed.knowledgeChunks.find((chunk) => {
      if (chunk.destination_id !== destination.id) return false;
      return tags.some((tag) => (chunk.tags || []).includes(tag));
    }) || null;
  }

  function hydrateActivity(activityId, destination, seed) {
    const base = seed.activities[activityId];
    if (!base) {
      const text = "Verify this activity locally before relying on it.";
      return {
        id: activityId,
        title: activityId.replace(/_/g, " "),
        description: text,
        activity_type: "unknown",
        claim: claim(text, CONFIDENCE.MODEL_INFERRED)
      };
    }

    const chunk = retrieveChunkForActivity(base, destination, seed);
    const confidence = chunk ? CONFIDENCE.SOURCE_BACKED : CONFIDENCE.MODEL_INFERRED;
    const source = chunk ? {
      source_name: chunk.source_name,
      source_url: chunk.source_url,
      source_type: "knowledge_chunk"
    } : null;

    return {
      id: activityId,
      title: base.title,
      description: base.description,
      activity_type: base.activity_type,
      tags: base.tags || [],
      claim: claim(base.description, confidence, source)
    };
  }

  function buildItineraryDays(trip, destination, seed) {
    const start = parseDate(trip.startDate);
    const end = parseDate(trip.endDate);
    const duration = diffDays(start, end);
    const pace = PACE_SETTINGS[trip.pace] || PACE_SETTINGS.mixed;
    const templates = destination ? destination.planTemplates : unknownDestinationTemplates();

    return Array.from({ length: duration }, (_, index) => {
      const date = addDays(start, index);
      const template = templates[index % templates.length];
      const shouldRest = pace.restEvery > 0 && index > 0 && (index + 1) % pace.restEvery === 0;
      const activityIds = shouldRest ? ["rest_recovery"] : template.activities.slice(0, pace.activitiesPerDay);
      const activities = activityIds.map((activityId) => {
        if (activityId === "rest_recovery") {
          const text = "Keep the day intentionally light to protect the rest of the itinerary.";
          return {
            id: "rest_recovery",
            title: "Recovery block",
            description: text,
            activity_type: "rest",
            claim: claim(text, CONFIDENCE.MODEL_INFERRED)
          };
        }
        return hydrateActivity(activityId, destination, seed);
      });

      return {
        day_number: index + 1,
        date: formatDate(date),
        location: template.location,
        summary: shouldRest ? "Recovery day." : template.summary,
        is_rest_day: shouldRest,
        rest_reason: shouldRest ? "Relaxed pace inserts a recovery day." : null,
        metrics: {
          daily_elevation_gain_m: shouldRest
            ? 0
            : Math.round((template.metrics.daily_elevation_gain_m || 0) * pace.elevationMultiplier)
        },
        activities,
        alerts: []
      };
    });
  }

  function unknownDestinationTemplates() {
    return [
      {
        location: "Destination area",
        summary: "General-purpose day plan pending a specialized destination profile.",
        metrics: { daily_elevation_gain_m: 0 },
        activities: ["unknown_local_orientation", "unknown_flexible_block"]
      }
    ];
  }

  function compare(actual, operator, threshold) {
    if (operator === ">") return actual > threshold;
    if (operator === ">=") return actual >= threshold;
    if (operator === "<") return actual < threshold;
    if (operator === "<=") return actual <= threshold;
    if (operator === "===") return actual === threshold;
    return false;
  }

  function applyRuleModifiers(rule, travelerFlags) {
    const config = rule.condition_config || {};
    const matchingModifiers = (config.modifiers || []).filter((modifier) => {
      return travelerFlags.includes(modifier.traveler_flag);
    });

    const threshold = matchingModifiers.reduce((current, modifier) => {
      if (typeof modifier.threshold !== "number") return current;
      return Math.min(current, modifier.threshold);
    }, config.threshold);

    const severityRank = matchingModifiers.reduce((rank, modifier) => {
      return Math.min(2, rank + (modifier.severity_delta || 0));
    }, SEVERITY_RANK[rule.severity] || 0);

    return {
      threshold,
      severity: SEVERITY_BY_RANK[severityRank]
    };
  }

  function template(text, values) {
    return String(text || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : "";
    });
  }

  function makeAlert(rule, values, severity, day) {
    const message = template(rule.explanation_template, values);
    const suggestedFix = template(rule.suggested_fix_template, values);
    return {
      id: `alert-${rule.rule_key}-${day ? day.day_number : "trip"}-${Math.random().toString(36).slice(2, 7)}`,
      rule_key: rule.rule_key,
      rule_id: rule.id,
      severity,
      day_number: day ? day.day_number : null,
      message,
      suggested_fix: suggestedFix,
      repair: rule.condition_config ? rule.condition_config.repair : null,
      claim: claim(`${message} ${suggestedFix}`, CONFIDENCE.MODEL_INFERRED)
    };
  }

  function evaluateThresholdCheck(rule, context) {
    const config = rule.condition_config || {};
    const results = [];
    const modified = applyRuleModifiers(rule, context.trip.traveler_flags);

    if (config.scope === "day") {
      context.days.forEach((day) => {
        const actual = Number(day.metrics[rule.metric_key]);
        if (Number.isFinite(actual) && compare(actual, config.operator, modified.threshold)) {
          results.push(makeAlert(rule, {
            day_number: day.day_number,
            actual,
            threshold: modified.threshold,
            metric_key: rule.metric_key
          }, modified.severity, day));
        }
      });
    }

    return results;
  }

  function dateFromMmDd(year, mmdd) {
    const parts = mmdd.split("-").map(Number);
    return new Date(year, parts[0] - 1, parts[1]);
  }

  function rangesOverlap(startA, endA, startB, endB) {
    return startA <= endB && startB <= endA;
  }

  function annualWindowOverlaps(start, end, window) {
    const years = [];
    for (let year = start.getFullYear() - 1; year <= end.getFullYear() + 1; year += 1) {
      years.push(year);
    }

    return years.some((year) => {
      let windowStart = dateFromMmDd(year, window.start_mm_dd);
      let windowEnd = dateFromMmDd(year, window.end_mm_dd);
      if (windowEnd < windowStart) {
        windowEnd = dateFromMmDd(year + 1, window.end_mm_dd);
      }
      return rangesOverlap(start, end, windowStart, windowEnd);
    });
  }

  function evaluateDateRangeOverlap(rule, context) {
    const config = rule.condition_config || {};
    const start = parseDate(context.trip.startDate);
    const end = parseDate(context.trip.endDate);
    const results = [];

    if (config.scope === "trip") {
      (config.windows || []).forEach((window) => {
        if (annualWindowOverlaps(start, end, window)) {
          results.push(makeAlert(rule, { label: window.label }, rule.severity, null));
        }
      });
    }

    return results;
  }

  function evaluateAvailabilityWindowCheck(rule, context) {
    const config = rule.condition_config || {};
    const closedWindows = config.closed_windows || [];
    const allowedTypes = config.activity_types || [];
    const results = [];

    context.days.forEach((day) => {
      const dayDate = parseDate(day.date);
      day.activities.forEach((activity) => {
        if (!allowedTypes.includes(activity.activity_type)) return;
        closedWindows.forEach((window) => {
          if (annualWindowOverlaps(dayDate, dayDate, window)) {
            results.push(makeAlert(rule, {
              activity_title: activity.title,
              label: window.label,
              day_number: day.day_number
            }, rule.severity, day));
          }
        });
      });
    });

    return results;
  }

  const EVALUATORS = {
    threshold_check: evaluateThresholdCheck,
    date_range_overlap: evaluateDateRangeOverlap,
    availability_window_check: evaluateAvailabilityWindowCheck
  };

  function evaluateConstraints(trip, destination, days, seed) {
    if (!destination) return [];
    const context = { trip, destination, days };
    return seed.constraintRules
      .filter((rule) => rule.enabled && rule.profile_type === destination.profile_type)
      .flatMap((rule) => {
        const evaluator = EVALUATORS[rule.rule_type];
        return evaluator ? evaluator(rule, context) : [];
      });
  }

  function applyRepairs(days, alerts) {
    alerts.forEach((alert) => {
      const repair = alert.repair;
      if (!repair || repair.action !== "convert_next_day_to_rest" || !alert.day_number) return;
      const target = days.find((day) => day.day_number === alert.day_number + 1);
      if (!target || target.is_rest_day) return;
      const text = repair.rest_reason || "Added by the constraint engine.";
      target.is_rest_day = true;
      target.rest_reason = text;
      target.summary = "Recovery day.";
      target.metrics.daily_elevation_gain_m = 0;
      target.activities = [
        {
          id: "constraint_rest",
          title: "Constraint-driven rest day",
          description: text,
          activity_type: "rest",
          claim: claim(text, CONFIDENCE.MODEL_INFERRED)
        }
      ];
    });
  }

  function attachDayAlerts(days, alerts) {
    days.forEach((day) => {
      day.alerts = alerts.filter((alert) => alert.day_number === day.day_number);
    });
  }

  function getEntryRequirements(trip, destination, seed, today) {
    if (!destination) return [];
    const currentDate = today ? parseDate(formatDate(today)) : parseDate(formatDate(new Date()));
    const start = parseDate(trip.startDate);

    return seed.entryRequirements
      .filter((requirement) => requirement.destination_id === destination.id)
      .map((requirement) => {
        const actionDate = addDays(start, -requirement.recommended_lead_time_days);
        const daysToAct = diffDays(currentDate, actionDate);
        const urgency = daysToAct < 0 ? "act immediately" : `${daysToAct} day${daysToAct === 1 ? "" : "s"} left`;
        const text = `${requirement.name}: ${requirement.notes}`;
        return {
          ...requirement,
          latest_recommended_action_date: formatDate(actionDate),
          urgency,
          claim: claim(text, CONFIDENCE.SOURCE_BACKED, {
            source_name: requirement.source_name,
            source_url: requirement.source_url,
            source_type: "entry_requirement"
          })
        };
      });
  }

  function getLiveWarnings(trip, destination, seed, now) {
    if (!destination) return [];
    const current = now || new Date();
    return seed.liveConditionCache
      .filter((item) => item.destination_id === destination.id && item.profile_type === destination.profile_type)
      .map((item) => {
        const fetchedAt = new Date(item.fetched_at);
        const ageHours = (current.getTime() - fetchedAt.getTime()) / (60 * 60 * 1000);
        const stale = ageHours > item.stale_after_hours;
        const suffix = stale ? ` Stale cache from ${item.fetched_at}.` : "";
        return {
          ...item,
          stale,
          claim: claim(`${item.synthesized_warning}${suffix}`, CONFIDENCE.SOURCE_BACKED, {
            source_name: item.source_name,
            source_url: item.source_url,
            source_type: item.check_type
          })
        };
      });
  }

  function buildUnknownProfileNotice(trip) {
    const text = `No specialized constraint checks are available yet for ${trip.destination}.`;
    return {
      id: "unknown-profile-notice",
      rule_key: "unknown_destination_profile",
      severity: "info",
      day_number: null,
      message: text,
      suggested_fix: "Use this general itinerary as a starting point and verify local risks manually.",
      claim: claim(`${text} Use this general itinerary as a starting point and verify local risks manually.`, CONFIDENCE.MODEL_INFERRED)
    };
  }

  function generateItinerary(input, seed, options) {
    const errors = validateTripInput(input);
    if (errors.length) {
      return { ok: false, errors };
    }

    const destination = matchDestination(input.destination, seed);
    const trip = {
      origin: input.origin.trim(),
      destination: input.destination.trim(),
      destination_id: destination ? destination.id : null,
      destination_name: destination ? destination.name : input.destination.trim(),
      profile_type: destination ? destination.profile_type : "unknown",
      startDate: input.startDate,
      endDate: input.endDate,
      groupSize: Number(input.groupSize),
      pace: input.pace,
      notes: input.notes || "",
      traveler_flags: extractTravelerFlags(input.notes || "")
    };

    const days = buildItineraryDays(trip, destination, seed);
    const constraintAlerts = evaluateConstraints(trip, destination, days, seed);
    applyRepairs(days, constraintAlerts);
    attachDayAlerts(days, constraintAlerts);

    const notices = destination ? [] : [buildUnknownProfileNotice(trip)];
    const entryRequirements = getEntryRequirements(trip, destination, seed, options ? options.today : undefined);
    const liveWarnings = getLiveWarnings(trip, destination, seed, options ? options.now : undefined);

    return {
      ok: true,
      trip,
      destination,
      days,
      alerts: notices.concat(constraintAlerts),
      entryRequirements,
      liveWarnings,
      generated_at: new Date().toISOString()
    };
  }

  const api = {
    CONFIDENCE,
    PACE_SETTINGS,
    validateTripInput,
    matchDestination,
    extractTravelerFlags,
    buildItineraryDays,
    evaluateConstraints,
    getEntryRequirements,
    getLiveWarnings,
    generateItinerary,
    parseDate,
    formatDate,
    diffDays
  };

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.TrailSenseEngine = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

