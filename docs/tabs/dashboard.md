# Dashboard Tab Specification

## Purpose

The Dashboard tab provides a real-time snapshot of nutrition progress for the current day.

Core outcomes:

- Daily nutrient completion score
- Nutrient progress visibility
- Remaining nutrient gaps
- Lightweight trend insights

## UI Scope

Required sections:

- Daily completion score card
- Nutrient progress bars (priority nutrients from nutrient master file)
- Remaining nutrients / deficiency list
- Trend insights section

Design requirements:

- Mobile-first layout
- shadcn UI components only
- Dark theme consistent with app

## Data Dependencies

Primary data sources:

- `daily_logs`:
  - `log_date`
  - `consumed_nutrients`
  - `completion_score`
  - `nutrient_snapshot`
- `user_profile.required_nutrients`
- `meal_entries` (for meal count and trend context)
- `src/config/nutrients.json` dashboard priority list

State dependencies (Zustand):

- `dailyLog`
- `meals`
- `userProfile`
- loading and error states

## Calculation Rules

Use nutrient engine rules from master spec:

- `nutrient_total = per100g_value * quantity / 100`
- `score = average(min(consumed/required,1)) * 100`
- Cap excess contribution at 100% per nutrient
- Never recalculate historical logs after profile requirement changes

## Backend and Service Flow

Recommended load flow:

1. Fetch profile + current day log
2. Fetch meals for current day range
3. Render completion + nutrient progress + deficiencies

Tech constraints:

- Supabase backend
- No direct OpenAI calls from dashboard
- Respect RLS policies

## Offline and PWA

When offline:

- Show latest cached dashboard data
- Allow read-only dashboard rendering
- Revalidate when network returns

PWA behavior:

- Cache static assets and nutrient config
- Use IndexedDB-backed fallback for local data availability

## Security and Validation

- Validate all numeric nutrient values before rendering
- Guard against malformed nutrient JSON payloads
- Do not trust client-only score values when persisted; server data remains source of record

## Success Criteria (Dashboard-specific)

- User can see daily score and top nutrient gaps immediately
- Dashboard remains usable on mobile and offline
- Data remains consistent with logged meals and profile requirements

## Hard Rule

- Always build/design mobile focused.
