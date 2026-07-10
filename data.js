(function seedFactory(root) {
  const seed = {
    destinations: [
      {
        id: "sikkim-darjeeling",
        name: "Sikkim and Darjeeling",
        region: "Eastern Himalaya",
        country: "India",
        profile_type: "mountain",
        aliases: ["sikkim", "darjeeling", "gangtok", "pelling", "yumthang", "eastern himalaya"],
        latitude: 27.3389,
        longitude: 88.6065,
        planTemplates: [
          {
            location: "Gangtok",
            summary: "Arrive, settle in, and keep the first day light.",
            metrics: { daily_elevation_gain_m: 220 },
            activities: ["gangtok_orientation", "mg_marg_evening", "permit_buffer"]
          },
          {
            location: "Tsomgo Lake route",
            summary: "High-altitude lake day with permit and weather checks.",
            metrics: { daily_elevation_gain_m: 720 },
            activities: ["tsomgo_lake", "baba_mandir", "early_return"]
          },
          {
            location: "Lachung",
            summary: "Move north with road-condition buffers.",
            metrics: { daily_elevation_gain_m: 860 },
            activities: ["lachung_drive", "roadside_stops", "early_night"]
          },
          {
            location: "Yumthang Valley",
            summary: "Valley excursion with a flexible weather window.",
            metrics: { daily_elevation_gain_m: 640 },
            activities: ["yumthang_valley", "hot_springs", "slow_afternoon"]
          },
          {
            location: "Darjeeling",
            summary: "Shift to Darjeeling and lower the exertion level.",
            metrics: { daily_elevation_gain_m: 520 },
            activities: ["darjeeling_transfer", "mall_road", "tea_room"]
          },
          {
            location: "Darjeeling",
            summary: "Classic viewpoints and tea-estate time.",
            metrics: { daily_elevation_gain_m: 430 },
            activities: ["tiger_hill", "tea_estate", "himalayan_railway"]
          }
        ]
      },
      {
        id: "goa",
        name: "Goa",
        region: "Konkan Coast",
        country: "India",
        profile_type: "coastal",
        aliases: ["goa", "panaji", "panjim", "north goa", "south goa", "konkan"],
        latitude: 15.2993,
        longitude: 74.124,
        planTemplates: [
          {
            location: "Panaji and Fontainhas",
            summary: "Ease into the trip with heritage lanes and a riverfront evening.",
            metrics: { daily_elevation_gain_m: 60 },
            activities: ["fontainhas_walk", "mandovi_evening", "local_cafe"]
          },
          {
            location: "North Goa",
            summary: "Beach morning, fort viewpoint, and a slower afternoon.",
            metrics: { daily_elevation_gain_m: 110 },
            activities: ["beach_morning", "chapora_fort", "seafood_dinner"]
          },
          {
            location: "South Goa",
            summary: "Quieter beaches and a late-day village stop.",
            metrics: { daily_elevation_gain_m: 80 },
            activities: ["palolem_beach", "village_stop", "sunset_buffer"]
          },
          {
            location: "Mollem area",
            summary: "Inland nature day with seasonal access checks.",
            metrics: { daily_elevation_gain_m: 210 },
            activities: ["dudhsagar_view", "spice_plantation", "early_return"]
          },
          {
            location: "North Goa",
            summary: "Water activity window if seasonal marine conditions allow.",
            metrics: { daily_elevation_gain_m: 90 },
            activities: ["water_sports", "anjuna_market", "coastal_dinner"]
          }
        ]
      }
    ],
    activities: {
      gangtok_orientation: {
        title: "Gangtok orientation",
        description: "Keep arrival day gentle and use the evening to confirm next-day permits and road timing.",
        activity_type: "city_walk",
        tags: ["gangtok", "arrival", "acclimatization"]
      },
      mg_marg_evening: {
        title: "MG Marg evening walk",
        description: "A short central walk works well after arrival without adding avoidable altitude stress.",
        activity_type: "city_walk",
        tags: ["gangtok", "light_activity"]
      },
      permit_buffer: {
        title: "Permit buffer",
        description: "Keep time aside for documents, photo IDs, and route confirmations before protected-area travel.",
        activity_type: "permit_admin",
        tags: ["permit", "sikkim"]
      },
      tsomgo_lake: {
        title: "Tsomgo Lake",
        description: "Plan this as an early out-and-back and keep the afternoon flexible for weather or road holds.",
        activity_type: "high_altitude_excursion",
        tags: ["tsomgo", "high_altitude", "permit"]
      },
      baba_mandir: {
        title: "Baba Mandir add-on",
        description: "Treat this as optional if the road, weather, or group energy is not cooperating.",
        activity_type: "high_altitude_excursion",
        tags: ["tsomgo", "optional"]
      },
      early_return: {
        title: "Early return buffer",
        description: "Return before late-afternoon weather changes and keep dinner close to the hotel.",
        activity_type: "buffer",
        tags: ["weather", "buffer"]
      },
      lachung_drive: {
        title: "Drive to Lachung",
        description: "Use an early departure and keep landslide or road-work alternatives ready.",
        activity_type: "mountain_drive",
        tags: ["lachung", "road_conditions"]
      },
      roadside_stops: {
        title: "Low-exertion roadside stops",
        description: "Short photo and tea stops are safer than packing the transfer day with hikes.",
        activity_type: "scenic_stop",
        tags: ["low_exertion", "transfer"]
      },
      early_night: {
        title: "Early night",
        description: "Sleep and hydration are part of the plan after a large elevation change.",
        activity_type: "rest",
        tags: ["altitude", "rest"]
      },
      yumthang_valley: {
        title: "Yumthang Valley",
        description: "Keep this as the main activity of the day and avoid stacking another long excursion after it.",
        activity_type: "valley_excursion",
        tags: ["yumthang", "weather"]
      },
      hot_springs: {
        title: "Hot springs stop",
        description: "Use this as a short comfort stop if access and timing are favorable.",
        activity_type: "wellness",
        tags: ["yumthang", "optional"]
      },
      slow_afternoon: {
        title: "Slow afternoon",
        description: "Leave the second half of the day open for recovery and route uncertainty.",
        activity_type: "rest",
        tags: ["rest", "buffer"]
      },
      darjeeling_transfer: {
        title: "Transfer to Darjeeling",
        description: "Keep this day mostly logistical and avoid a late-night arrival.",
        activity_type: "mountain_drive",
        tags: ["darjeeling", "transfer"]
      },
      mall_road: {
        title: "Mall Road stroll",
        description: "A light walk after the transfer keeps the day useful without overloading it.",
        activity_type: "city_walk",
        tags: ["darjeeling", "light_activity"]
      },
      tea_room: {
        title: "Tea-room stop",
        description: "Choose a close, low-effort stop rather than another viewpoint after the transfer.",
        activity_type: "food",
        tags: ["darjeeling", "tea"]
      },
      tiger_hill: {
        title: "Tiger Hill sunrise",
        description: "Plan an early start only if the group has recovered from prior travel days.",
        activity_type: "viewpoint",
        tags: ["darjeeling", "sunrise"]
      },
      tea_estate: {
        title: "Tea-estate visit",
        description: "Pair the visit with a relaxed lunch rather than a second long drive.",
        activity_type: "culture",
        tags: ["darjeeling", "tea"]
      },
      himalayan_railway: {
        title: "Himalayan Railway joy ride",
        description: "Keep booking and timing flexible because service schedules can change.",
        activity_type: "heritage_rail",
        tags: ["darjeeling", "railway"]
      },
      fontainhas_walk: {
        title: "Fontainhas walk",
        description: "Start with a shaded heritage walk before the day gets hot.",
        activity_type: "heritage_walk",
        tags: ["fontainhas", "panaji"]
      },
      mandovi_evening: {
        title: "Mandovi riverfront evening",
        description: "Use the riverfront as a low-risk first evening plan.",
        activity_type: "riverfront",
        tags: ["panaji", "evening"]
      },
      local_cafe: {
        title: "Local cafe stop",
        description: "A flexible meal stop keeps the arrival day simple.",
        activity_type: "food",
        tags: ["food", "arrival"]
      },
      beach_morning: {
        title: "Beach morning",
        description: "Use the safer morning window and check lifeguard flags before entering the water.",
        activity_type: "beach",
        tags: ["beach", "safety"]
      },
      chapora_fort: {
        title: "Chapora Fort viewpoint",
        description: "Pair the climb with water and a short visit rather than a midday push.",
        activity_type: "viewpoint",
        tags: ["fort", "north_goa"]
      },
      seafood_dinner: {
        title: "Seafood dinner",
        description: "Keep dinner close to the day's final stop to reduce night driving.",
        activity_type: "food",
        tags: ["food", "north_goa"]
      },
      palolem_beach: {
        title: "Palolem beach time",
        description: "Use a calm beach block with a clear exit plan if rain or surf changes.",
        activity_type: "beach",
        tags: ["beach", "south_goa"]
      },
      village_stop: {
        title: "Village stop",
        description: "A short inland stop gives the day variety without depending on sea conditions.",
        activity_type: "culture",
        tags: ["south_goa", "culture"]
      },
      sunset_buffer: {
        title: "Sunset buffer",
        description: "Leave the last hour flexible because coastal weather can change quickly.",
        activity_type: "buffer",
        tags: ["weather", "coast"]
      },
      dudhsagar_view: {
        title: "Dudhsagar access check",
        description: "Treat access as seasonal and verify the current route before leaving.",
        activity_type: "seasonal_nature",
        tags: ["dudhsagar", "seasonal_access"]
      },
      spice_plantation: {
        title: "Spice plantation visit",
        description: "This is a useful inland alternative when beach or marine plans are disrupted.",
        activity_type: "culture",
        tags: ["spice", "inland"]
      },
      water_sports: {
        title: "Water sports window",
        description: "Only book if operators are running and marine warnings are clear for the day.",
        activity_type: "marine_activity",
        tags: ["water_sports", "marine"]
      },
      anjuna_market: {
        title: "Anjuna market",
        description: "Keep it as a flexible dry-land option if water activities are not sensible.",
        activity_type: "market",
        tags: ["market", "north_goa"]
      },
      coastal_dinner: {
        title: "Coastal dinner",
        description: "Close the route with a nearby dinner rather than another beach hop.",
        activity_type: "food",
        tags: ["food", "coast"]
      }
    },
    constraintRules: [
      {
        id: "rule-mountain-elevation-gain",
        profile_type: "mountain",
        rule_key: "daily_elevation_gain_limit",
        rule_type: "threshold_check",
        metric_key: "daily_elevation_gain_m",
        condition_config: {
          scope: "day",
          operator: ">",
          threshold: 800,
          modifiers: [
            { traveler_flag: "altitude_sensitivity", threshold: 500, severity_delta: 1 },
            { traveler_flag: "traveling_with_elderly", threshold: 600, severity_delta: 1 },
            { traveler_flag: "traveling_with_children", threshold: 650, severity_delta: 1 },
            { traveler_flag: "mobility_concern", threshold: 650, severity_delta: 1 }
          ],
          repair: {
            action: "convert_next_day_to_rest",
            rest_reason: "Added because the previous day exceeds the trip's elevation-gain threshold."
          }
        },
        severity: "warning",
        explanation_template: "Day {day_number} gains {actual}m of elevation, above the recommended {threshold}m limit for this trip.",
        suggested_fix_template: "Insert a rest day or split the route into two lower-gain days.",
        enabled: true
      },
      {
        id: "rule-coastal-monsoon-overlap",
        profile_type: "coastal",
        rule_key: "monsoon_window_overlap",
        rule_type: "date_range_overlap",
        condition_config: {
          scope: "trip",
          windows: [
            { start_mm_dd: "06-01", end_mm_dd: "09-30", label: "monsoon season" }
          ]
        },
        severity: "warning",
        explanation_template: "Your dates overlap {label}, when beach and marine plans may be disrupted.",
        suggested_fix_template: "Keep flexible inland alternatives and verify marine conditions before booking water activities.",
        enabled: true
      },
      {
        id: "rule-coastal-marine-closures",
        profile_type: "coastal",
        rule_key: "seasonal_marine_activity_closure",
        rule_type: "availability_window_check",
        condition_config: {
          scope: "activity",
          activity_types: ["marine_activity"],
          closed_windows: [
            { start_mm_dd: "06-01", end_mm_dd: "09-30", label: "seasonal marine-activity closure window" }
          ]
        },
        severity: "critical",
        explanation_template: "{activity_title} falls inside {label}.",
        suggested_fix_template: "Swap this for an inland activity and re-check licensed operators closer to the date.",
        enabled: true
      }
    ],
    entryRequirements: [
      {
        id: "entry-sikkim-permit",
        destination_id: "sikkim-darjeeling",
        requirement_type: "domestic_permit",
        name: "Sikkim protected-area permit check",
        recommended_lead_time_days: 14,
        notes: "Protected or restricted areas may require permits and identity documents. Confirm the latest requirement before booking high-altitude excursions.",
        source_name: "Sikkim Tourism permit guidance",
        source_url: "https://www.sikkimtourism.gov.in/"
      },
      {
        id: "entry-sikkim-id",
        destination_id: "sikkim-darjeeling",
        requirement_type: "identity_document",
        name: "Government photo ID for permits and hotels",
        recommended_lead_time_days: 7,
        notes: "Carry original ID and spare copies for hotel check-in and route permits.",
        source_name: "Curated TrailSense pilot notes",
        source_url: "https://www.sikkimtourism.gov.in/"
      },
      {
        id: "entry-goa-marine-advisory",
        destination_id: "goa",
        requirement_type: "safety_advisory",
        name: "Beach safety and water-activity operator check",
        recommended_lead_time_days: 3,
        notes: "Verify lifeguard flags, licensed operators, and seasonal restrictions before confirming marine activities.",
        source_name: "Goa Tourism safety guidance",
        source_url: "https://goa-tourism.com/"
      }
    ],
    knowledgeChunks: [
      {
        id: "chunk-gangtok-acclimatize",
        destination_id: "sikkim-darjeeling",
        source_name: "Curated Eastern Himalaya pilot notes",
        source_url: "https://www.sikkimtourism.gov.in/",
        text: "Arrival in Gangtok should be kept light before high-altitude excursions so travelers have time to acclimatize and complete permit checks.",
        tags: ["gangtok", "arrival", "acclimatization", "light_activity", "permit"]
      },
      {
        id: "chunk-tsomgo-permit",
        destination_id: "sikkim-darjeeling",
        source_name: "Sikkim Tourism route and permit notes",
        source_url: "https://www.sikkimtourism.gov.in/",
        text: "Tsomgo Lake and nearby high-altitude routes are weather-sensitive and may require permit checks, so early departures and flexible returns are recommended.",
        tags: ["tsomgo", "high_altitude", "permit", "weather", "optional"]
      },
      {
        id: "chunk-lachung-roads",
        destination_id: "sikkim-darjeeling",
        source_name: "Curated North Sikkim road notes",
        source_url: "https://www.sikkimtourism.gov.in/",
        text: "North Sikkim transfers should leave room for road holds, landslide delays, and low-exertion stops.",
        tags: ["lachung", "road_conditions", "transfer", "low_exertion"]
      },
      {
        id: "chunk-darjeeling-tea",
        destination_id: "sikkim-darjeeling",
        source_name: "Darjeeling tourism pilot notes",
        source_url: "https://www.wbtourism.gov.in/",
        text: "Darjeeling tea-estate visits and the Himalayan Railway work best when paired with lighter transfer days and flexible schedules.",
        tags: ["darjeeling", "tea", "railway", "sunrise"]
      },
      {
        id: "chunk-fontainhas",
        destination_id: "goa",
        source_name: "Goa Tourism heritage notes",
        source_url: "https://goa-tourism.com/",
        text: "Fontainhas and Panaji heritage walks are practical low-risk activities, especially when beaches are affected by weather.",
        tags: ["fontainhas", "panaji", "evening"]
      },
      {
        id: "chunk-beach-safety",
        destination_id: "goa",
        source_name: "Goa coastal safety pilot notes",
        source_url: "https://goa-tourism.com/",
        text: "Beach plans should be paired with lifeguard-flag checks and flexible dry-land alternatives during unsettled weather.",
        tags: ["beach", "safety", "weather", "coast"]
      },
      {
        id: "chunk-inland-goa",
        destination_id: "goa",
        source_name: "Goa inland alternatives pilot notes",
        source_url: "https://goa-tourism.com/",
        text: "Spice plantations, village stops, and markets provide useful inland alternatives when marine activities are restricted.",
        tags: ["spice", "inland", "market", "culture"]
      }
    ],
    liveConditionCache: [
      {
        destination_id: "sikkim-darjeeling",
        profile_type: "mountain",
        check_type: "weather",
        source_name: "Demo weather cache",
        source_url: "https://openweathermap.org/",
        fetched_at: "2026-07-09T09:00:00+05:30",
        stale_after_hours: 24,
        synthesized_warning: "Expect unsettled afternoon weather; keep high-altitude excursions early and preserve return buffers."
      },
      {
        destination_id: "sikkim-darjeeling",
        profile_type: "mountain",
        check_type: "road_condition",
        source_name: "Demo road-condition cache",
        source_url: "https://www.sikkimtourism.gov.in/",
        fetched_at: "2026-07-08T16:00:00+05:30",
        stale_after_hours: 24,
        synthesized_warning: "Recent mountain-road conditions should be verified before the Lachung and Yumthang sections."
      },
      {
        destination_id: "goa",
        profile_type: "coastal",
        check_type: "weather",
        source_name: "Demo weather cache",
        source_url: "https://openweathermap.org/",
        fetched_at: "2026-07-09T10:30:00+05:30",
        stale_after_hours: 24,
        synthesized_warning: "Rain bands may affect beach plans; keep inland alternates ready."
      },
      {
        destination_id: "goa",
        profile_type: "coastal",
        check_type: "marine_condition",
        source_name: "Demo marine-condition cache",
        source_url: "https://goa-tourism.com/",
        fetched_at: "2026-07-08T12:00:00+05:30",
        stale_after_hours: 24,
        synthesized_warning: "Marine activity status must be re-checked locally during monsoon months."
      }
    ]
  };

  if (typeof module === "object" && module.exports) {
    module.exports = seed;
  } else {
    root.TRAILSENSE_SEED = seed;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

