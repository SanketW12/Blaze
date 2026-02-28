# Profile Tab Specification

## Purpose

The Profile tab captures body metrics and activity context to compute personalized nutrient requirements used by daily tracking.

Core outcomes:

- Editable body metrics and activity level
- BMI and BMR calculation visibility
- Requirement recalculation for future logs
- Offline-safe profile updates

## UI Scope

Required sections:

- Age input
- Weight input
- Height input
- Activity level selector
- Computed BMI/BMR summary
- Save action and status feedback

Design requirements:

- Mobile-first form design
- shadcn UI components only
- Dark theme consistent with app

## Data and Persistence

Primary table:

- `user_profile`

Key fields:

- `age`
- `weight_kg`
- `height_cm`
- `activity_level`
- `bmi`
- `bmr`
- `required_nutrients` (JSON)

State dependencies (Zustand):

- `userProfile`
- loading/error states

## Calculation Logic

On save:

1. Recalculate BMI from height + weight
2. Recalculate BMR from age + height + weight
3. Recalculate `required_nutrients` from user profile inputs
4. Persist to `user_profile`

Important rule from master spec:

- Requirement changes should apply to future logs
- Past daily logs should remain historically accurate

## Backend and Security

Constraints:

- Use Supabase for profile read/write
- Enforce RLS on profile row access
- Validate numeric ranges before write
- Sanitize all profile inputs

## Offline and Queueing

When offline:

- Queue profile update in IndexedDB
- Show queued status to user
- Sync automatically on reconnect

Conflict policy:

- Last-write-wins is acceptable for single user

## Success Criteria (Profile-specific)

- User can save and reload profile reliably
- Personalized nutrient requirements are available for meal/log scoring
- Offline profile edits are not lost
