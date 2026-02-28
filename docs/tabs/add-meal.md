# Add Meal Tab Specification

## Purpose

The Add Meal tab captures meals quickly from text or images, converts them to structured food items, confirms nutrient interpretation, and persists meal + daily nutrient updates.

Core outcomes:

- Fast meal logging (< 10 seconds target)
- AI-assisted extraction from text/image
- User confirmation before final save
- Offline queue support

## UI Scope

Required sections:

- Meal text input
- Meal image upload
- Parse action (AI)
- Parsed food confirmation list (editable food name/quantity/unit)
- Confirm/save meal action
- Status messaging (loading/error/offline queued)

Design requirements:

- Mobile-first interaction
- shadcn UI components only
- Dark theme consistent with app

## AI Integration

Uses Food Extraction Assistant via Supabase Edge Function.

Rules:

- Client sends text and/or base64 image to edge function
- Edge function calls OpenAI assistant
- Assistant must return strict JSON only, no explanations
- Output shape:

`{ "foods": [ { "name": "egg", "quantity": 2, "unit": "piece" } ] }`

Important:

- OpenAI API key never exposed in frontend
- Edge function validates request and normalizes response

## Data and Persistence

Primary write targets:

- `meal_entries` per confirmed food item
- `daily_logs` aggregate nutrient updates for the day

Required calculations:

- Convert quantity/unit into grams
- Build nutrient snapshot per meal item
- Aggregate into daily consumed nutrients
- Recompute daily completion score using capped ratio rule

State dependencies (Zustand):

- `dailyLog`
- `meals`
- `userProfile.required_nutrients`

## Offline and Queueing

When offline:

- Store meal operation in IndexedDB queue
- Show queued confirmation message
- Sync automatically when network reconnects

Queue payload should include enough data to replay:

- Parsed foods
- Nutrient snapshot data
- Source type (text/image)
- Log date

## Security and Validation

- Validate parsed foods before save (`name`, `quantity > 0`, allowed `unit`)
- Sanitize user-entered text fields
- Validate AI JSON response shape before using it
- Enforce RLS for all write operations

## Success Criteria (Add Meal-specific)

- User can parse and save text/image meals reliably
- Nutrient totals update correctly on save
- Offline meal capture works and syncs later without data loss
