# TrailSense Design Document

## 1. Purpose

TrailSense is a constraint-aware trip planning agent. The v1 design proves that one data-driven constraint engine can handle two pilot profiles, mountain and coastal, while keeping recommendations grounded in retrieved content, live weather/search checks, and visible confidence tags.

This design resolves the open questions from the requirements as follows:

- Shareable links are public read-only URLs protected by unguessable tokens. They do not require account login.
- Confidence is binary in v1: `source-backed` or `model-inferred - verify locally`.
- Setup is bring-your-own-key for LLM, search, weather, and embeddings providers.

## 2. System Overview

### Recommended Stack

- Frontend: React + TypeScript, with responsive routes for trip input, generation progress, itinerary viewing, saved trips, and public shares.
- Backend: FastAPI + Python, with Pydantic request/response models and SQLAlchemy/Alembic for persistence.
- Database: PostgreSQL for production, SQLite allowed for local development.
- Vector store: Chroma for curated knowledge chunks.
- Auth: JWT access tokens, bcrypt/argon2 password hashing.
- PDF export: server-rendered itinerary HTML converted to PDF.
- External services behind interfaces: LLM provider, embeddings provider, weather provider, search provider.

The backend owns all planning, constraint evaluation, RAG retrieval, live lookups, confidence tagging, saving, sharing, and exporting. The frontend renders state and submits user actions, but does not make planning decisions.

### Major Backend Modules

- `auth`: user registration, login, password hashing, JWT issuance, auth middleware.
- `trip_input`: validation, destination matching, pace and note normalization.
- `rag`: curated-source ingestion, embedding, retrieval, and source metadata lookup.
- `planner`: itinerary skeleton generation, RAG-aware recommendation generation, repair loop.
- `constraints`: data-driven rule selection and generic evaluator execution.
- `entry_requirements`: generic requirement lookup and lead-time urgency calculation.
- `live_checks`: weather calls, condition-search calls, caching, stale fallback.
- `confidence`: claim normalization, confidence assignment, source attachment.
- `exports`: PDF generation and share-token publishing.

## 3. Core Planning Flow

1. Traveler submits origin, destination, start date, end date, group size, pace, and optional notes.
2. Backend validates required fields and rejects end dates that are before or equal to the start date.
3. Destination matcher attempts to map destination text to a `Destinations` row.
4. If the destination is known, the trip inherits exactly one `profile_type`.
5. If the destination is unknown, the trip is still created with `profile_type = unknown` and a visible notice that specialized checks are unavailable.
6. Notes are normalized into traveler flags such as `altitude_sensitivity`, `mobility_concern`, `traveling_with_children`, and `traveling_with_elderly`.
7. Planner creates an initial day-by-day skeleton from duration and pace.
8. RAG retrieves destination- and activity-relevant chunks from Chroma.
9. LLM generates an itinerary draft using retrieved chunks where available.
10. Constraint engine loads eligible rules from `ConstraintRules` for the destination profile and evaluates them using generic rule-type evaluators.
11. If alerts require itinerary repair, planner applies concrete fixes such as rest-day insertion, activity swaps, or date-shift suggestions.
12. Live weather and condition checks run through configured live-check templates for the destination profile.
13. Entry requirements are calculated and urgency-tagged.
14. Every rendered claim receives exactly one confidence tag and, when source-backed, a source reference.
15. Final itinerary is saved, rendered in the UI, and can be exported or shared.

## 4. Data Model

### Users

Stores traveler accounts.

- `id`
- `email` unique
- `password_hash`
- `created_at`

### Destinations

Stores destinations and the profile that selects eligible rules.

- `id`
- `name`
- `region`
- `country`
- `profile_type`: exactly one value, such as `mountain`, `coastal`, `unknown`
- `aliases`: JSON array for matching user input
- `latitude`
- `longitude`
- `metadata`: JSON

Constraint evaluation must not branch on specific destination names or profile names in code. The profile is used only as a data filter.

### Trips

Stores traveler trip input and lifecycle state.

- `id`
- `user_id`
- `origin`
- `destination_input`
- `destination_id` nullable for unknown destinations
- `profile_type`
- `start_date`
- `end_date`
- `group_size`
- `pace`: `relaxed`, `mixed`, `adventure-heavy`
- `notes`
- `traveler_flags`: JSON array
- `status`: `draft`, `generating`, `finalized`, `failed`
- `created_at`
- `updated_at`

### ItineraryDays

- `id`
- `trip_id`
- `day_number`
- `date`
- `location`
- `summary`
- `is_rest_day`
- `rest_reason` nullable
- `metrics`: JSON, such as `daily_elevation_gain_m`, `drive_hours`, `activity_count`

### ItineraryActivities

- `id`
- `itinerary_day_id`
- `time_window`
- `title`
- `description`
- `location`
- `activity_type`
- `claim_id`
- `source_chunk_id` nullable

### ConstraintRules

Defines all profile-specific checks as data.

- `id`
- `profile_type`
- `rule_key`
- `rule_type`: generic evaluator key, such as `threshold_check`, `date_range_overlap`
- `metric_key`: optional metric read from trip/day/activity context
- `condition_config`: JSON
- `severity`: `info`, `warning`, `critical`
- `explanation_template`
- `suggested_fix_template`
- `enabled`

Example mountain rule:

```json
{
  "profile_type": "mountain",
  "rule_key": "daily_elevation_gain_limit",
  "rule_type": "threshold_check",
  "metric_key": "daily_elevation_gain_m",
  "condition_config": {
    "scope": "day",
    "operator": ">",
    "threshold": 800,
    "modifiers": [
      {
        "traveler_flag": "altitude_sensitivity",
        "threshold": 500,
        "severity_delta": 1
      },
      {
        "traveler_flag": "traveling_with_elderly",
        "threshold": 600,
        "severity_delta": 1
      }
    ]
  },
  "severity": "warning",
  "explanation_template": "This day gains {actual}m of elevation, above the recommended {threshold}m limit for this trip.",
  "suggested_fix_template": "Insert a rest day or split this route into two lower-gain days."
}
```

Example coastal rule:

```json
{
  "profile_type": "coastal",
  "rule_key": "monsoon_window_overlap",
  "rule_type": "date_range_overlap",
  "condition_config": {
    "scope": "trip",
    "windows": [
      { "start_mm_dd": "06-01", "end_mm_dd": "09-30", "label": "monsoon season" }
    ]
  },
  "severity": "warning",
  "explanation_template": "Your dates overlap {label}, when beach and marine plans may be disrupted.",
  "suggested_fix_template": "Keep flexible indoor alternatives and verify marine conditions before booking water activities."
}
```

### ConstraintAlerts

- `id`
- `trip_id`
- `itinerary_day_id` nullable
- `constraint_rule_id`
- `severity`
- `message`
- `suggested_fix`
- `claim_id`
- `created_at`

### EntryRequirements

Stores permits, visas, vaccinations, park permits, and future requirement types without schema changes.

- `id`
- `destination_id`
- `requirement_type`
- `name`
- `recommended_lead_time_days`
- `notes`
- `source_name`
- `source_url`
- `enabled`

### KnowledgeChunks

Metadata mirror of Chroma chunks for source display and traceability.

- `id`
- `destination_id`
- `profile_type`
- `source_name`
- `source_url`
- `source_type`: `tourism_board`, `travel_blog`, `trip_report`, `official_notice`, etc.
- `chunk_text`
- `chunk_hash`
- `embedded_at`

The full embedding vector lives in Chroma. Relational metadata keeps itinerary rendering and exports simple.

### LiveCheckTemplates

Keeps live-condition behavior data-driven instead of branching on profile names.

- `id`
- `profile_type`
- `check_type`: `weather`, `road_condition`, `landslide_condition`, `tide_condition`, `marine_condition`
- `query_template`
- `synthesis_prompt_template`
- `stale_after_hours`
- `enabled`

Mountain templates can search for road closures and landslide reports. Coastal templates can search for tide, marine, and seasonal sea-condition reports. Adding a desert profile later means inserting new templates, not changing live-check orchestration.

### LiveConditionCache

- `id`
- `destination_id`
- `profile_type`
- `check_type`
- `trip_window_start`
- `trip_window_end`
- `raw_payload`
- `synthesized_warning`
- `source_name`
- `source_url`
- `fetched_at`
- `expires_at`
- `status`: `fresh`, `stale`, `failed`

### Claims

Every user-visible factual or advisory claim references one row.

- `id`
- `trip_id`
- `text`
- `confidence_level`: `source-backed` or `model-inferred - verify locally`
- `source_type`: `knowledge_chunk`, `live_weather`, `live_search`, `entry_requirement`, `model`
- `source_ref_id` nullable
- `source_name` nullable
- `source_url` nullable
- `created_at`

### ShareLinks

- `id`
- `trip_id`
- `token_hash`
- `public_slug`
- `created_at`
- `expires_at` nullable
- `revoked_at` nullable

The public URL uses an unguessable token. The stored token is hashed.

## 5. Constraint Engine Design

The constraint engine has three responsibilities:

1. Build a normalized evaluation context from trip, itinerary, destination, and traveler flags.
2. Load rules by querying `ConstraintRules` where `profile_type = trip.profile_type` and `enabled = true`.
3. Dispatch each rule to a generic evaluator by `rule_type`.

No evaluator may contain logic like `if profile_type == "mountain"` or `if destination == "Goa"`. Profile-specific behavior belongs in database rows.

### Evaluation Context

The context exposes generic fields:

- `trip.start_date`
- `trip.end_date`
- `trip.duration_days`
- `trip.pace`
- `trip.traveler_flags`
- `days[]`
- `days[].date`
- `days[].metrics`
- `activities[]`
- `destination.profile_type`
- `destination.metadata`

### Initial Generic Evaluators

- `threshold_check`: compares a numeric metric against a configured threshold and operator.
- `date_range_overlap`: checks whether trip or day dates overlap configured annual or absolute windows.
- `required_gap_check`: checks minimum gap between high-intensity days, useful beyond mountain trips.
- `availability_window_check`: checks whether activities fall inside configured open/closed windows.

Future profiles can add rows that reuse these evaluators. A new evaluator is allowed only when the rule type is generic and reusable across profiles.

### Traveler Note Sensitivity

Optional notes are first converted into normalized flags. Rules can declare modifiers keyed by those flags. The generic evaluator applies the most conservative matching threshold and adjusts severity using configured deltas.

For example, altitude sensitivity does not appear as special mountain code. It appears as a traveler flag consumed by the `daily_elevation_gain_limit` rule row.

### Alert Shape

Each fired rule produces:

- `rule_key`
- severity
- plain-language explanation
- concrete suggested fix
- affected day or trip scope
- confidence claim

Constraint-generated claims are `model-inferred - verify locally` unless the rule references a source-backed dataset or entry in curated content.

## 6. RAG Design

### Ingestion

Curated sources for Sikkim/Darjeeling and Goa are ingested before v1 launch.

Ingestion steps:

1. Source URL and metadata are registered.
2. Content is fetched or manually uploaded.
3. Text is cleaned and split into chunks with overlap.
4. Each chunk is embedded and written to Chroma.
5. Chunk metadata is mirrored into `KnowledgeChunks`.

Source metadata must include `source_name`, `source_url`, destination, source type, and ingestion timestamp.

### Retrieval

During itinerary generation, planner retrieves chunks by:

- destination/profile metadata filters
- activity or location query
- trip timing query, when relevant
- source recency preference where available

If useful chunks exist, the LLM prompt must prefer them. Generated itinerary items that use a retrieved chunk create `source-backed` claims with the chunk source. Items without retrieved support are allowed, but must be tagged `model-inferred - verify locally`.

## 7. Live Risk Checks

Weather runs for every known destination with coordinates. Additional condition checks are selected from `LiveCheckTemplates`.

Live-check orchestration:

1. Query enabled templates for the trip profile.
2. Call weather provider for date window where supported.
3. Execute search-provider queries rendered from templates.
4. Synthesize raw weather/search results into day- or trip-specific warnings.
5. Save results in `LiveConditionCache`.
6. If a call fails, load the latest cache row for the same destination and check type.
7. If cached data exists, render it as stale with timestamp.
8. If no cached data exists, render a `model-inferred - verify locally` warning that live data could not be checked.

The itinerary generation endpoint should continue even when live lookups fail.

## 8. Entry Requirement Checker

Entry requirements are queried by destination and may be filtered by `requirement_type`. The UI renders them in an "Action required before you go" section separate from the itinerary.

For each requirement:

- Calculate `latest_recommended_action_date = trip.start_date - recommended_lead_time_days`.
- If the current date is after that action date, mark urgency as `act immediately`.
- Otherwise show remaining days to act.
- Always show the source and a persistent disclaimer that rules can change and should be verified with official sources close to travel.

Because requirement type is plain data, adding visas, vaccinations, or park permits later does not require schema or query changes.

## 9. API Design

### Auth

- `POST /auth/register`: create account, hash password, enforce unique email.
- `POST /auth/login`: validate password, return JWT.

### Trips

- `POST /trips`: validate input and create draft trip.
- `GET /trips`: list current user's saved trips.
- `GET /trips/{trip_id}`: fetch one owned trip.
- `PUT /trips/{trip_id}`: update draft trip input.
- `DELETE /trips/{trip_id}`: remove owned trip.

Trip-modifying routes require a valid JWT.

### Generation

- `POST /trips/{trip_id}/generate`: generate or regenerate itinerary.
- `GET /trips/{trip_id}/generation-status`: return current step for loading UI.

Generation status values:

- `validating trip`
- `matching destination`
- `retrieving sources`
- `drafting itinerary`
- `checking constraints`
- `checking weather`
- `checking local conditions`
- `preparing final itinerary`

### Exports and Sharing

- `POST /trips/{trip_id}/finalize`: mark itinerary final and save.
- `GET /trips/{trip_id}/export.pdf`: download styled PDF.
- `POST /trips/{trip_id}/share`: create public read-only share URL.
- `GET /share/{public_slug}/{token}`: render public itinerary.

## 10. Frontend Design

### Screens

- Auth screen: register/login.
- Trip builder: origin, destination, dates, group size, pace segmented control, optional notes.
- Generation progress: current step and non-blocking messages for live-check fallback.
- Itinerary view: action-required section, high-level alerts, day-by-day plan.
- Saved trips: list finalized and draft trips.
- Public share view: read-only itinerary without account controls.

### Itinerary View Requirements

- Entry requirements appear before the day-by-day plan.
- Each day shows day number, date, location, planned activities, and day-specific alerts.
- Rest days are visually marked and include the engine-generated reason.
- Every activity-level suggestion has an inline confidence badge.
- Source-backed badges show source name and link.
- Model-inferred badges use a distinct icon/color and the exact wording `verify locally`.
- Live-check stale data includes fetched timestamp.
- Mobile layout preserves all badges and source links at the point of the claim.

## 11. PDF Export

PDF export uses the same normalized itinerary data as the UI.

The PDF must include:

- Trip summary
- Entry requirements and disclaimer
- Constraint alerts and suggested fixes
- Day-by-day itinerary
- Activity-level confidence tags
- Source names and URLs where available
- Stale-live-data timestamps where applicable

PDF generation must not drop confidence labels because exported copies may be used offline.

## 12. Extensibility Rules

Adding a new profile, such as desert, should require:

1. New `Destinations` rows with `profile_type = desert`.
2. New `ConstraintRules` rows using existing generic evaluators where possible.
3. Optional new generic evaluator only if no existing evaluator can express the rule.
4. New `EntryRequirements` rows as needed.
5. New `KnowledgeChunks` from curated desert sources.
6. New `LiveCheckTemplates` rows for profile-specific searches.

The constraint engine must not be modified for a new profile unless a reusable evaluator is being added.

## 13. Error Handling and Degradation

- Invalid dates are rejected before trip creation.
- Unknown destination still creates a trip with visible "no specialized checks" messaging.
- Failed RAG retrieval allows model-inferred suggestions, visibly tagged.
- Failed weather/search calls fall back to stale cache where possible.
- If no stale cache exists, itinerary generation still completes with a visible warning.
- Generation should target completion within 30 seconds; long-running external calls should use timeouts.

## 14. Seed Data for v1

Minimum seed data:

- Destinations: Sikkim, Darjeeling, Goa.
- Profile types: `mountain`, `coastal`.
- Mountain rule: daily elevation gain limit with stricter thresholds for altitude sensitivity and elderly travelers.
- Mountain live templates: road condition and landslide searches.
- Coastal rules: monsoon/cyclone window overlap and activity closure window overlap.
- Coastal live templates: tide/marine condition searches.
- Entry requirements: relevant Sikkim/Darjeeling permits and Goa-specific advisories where applicable.
- Knowledge chunks: curated tourism-board pages, reputable travel blogs, and recent trip reports for both pilot regions.

## 15. Acceptance Traceability

- Requirement 1: `POST /trips` validation, `Trips` fields, pace-aware planner, traveler flags, unknown destination handling.
- Requirement 2: `Destinations.profile_type`, `ConstraintRules`, generic evaluators, alert generation, pilot mountain/coastal seed rows.
- Requirement 3: `EntryRequirements`, action-required UI, lead-time urgency calculation, source disclaimer.
- Requirement 4: `LiveCheckTemplates`, weather/search adapters, synthesis, `LiveConditionCache` stale fallback.
- Requirement 5: Chroma ingestion, `KnowledgeChunks`, retrieval-first planner behavior, source attachment.
- Requirement 6: `Claims`, inline confidence badges, source display.
- Requirement 7: `ItineraryDays`, `ItineraryActivities`, rest-day marking, day-specific alerts.
- Requirement 8: saved trips, PDF export, public read-only share links.
- Requirement 9: auth module, password hashing, JWT-protected mutation endpoints.
- Requirement 10: data-driven profiles/rules, 30-second generation target, graceful degradation, mobile UI.

## 16. Implementation Milestones

1. Project scaffold, auth, database migrations, and trip input validation.
2. Destination/profile seed data and unknown-destination handling.
3. Constraint engine with generic evaluators and mountain/coastal seed rules.
4. Itinerary data model and pace-aware skeleton generation.
5. RAG ingestion pipeline and Chroma retrieval for pilot regions.
6. LLM provider interface and grounded itinerary drafting.
7. Live weather/search adapters, cache, and stale fallback.
8. Entry requirement checker and action-required UI.
9. Confidence claim model and inline badges across UI and PDF.
10. Save, PDF export, and public share links.
11. End-to-end tests proving the same evaluator handles mountain and coastal profiles with no profile-specific evaluator branches.
