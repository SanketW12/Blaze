# Firebase Single-User Data Plan

## 1) Data model

### `app/userProfile` (single document)
- Basic profile: `age`, `weightKg`, `heightCm`, `activityLevel`, `bmi`, `bmr`
- Targets: `requiredNutrients` (all nutrient keys + calories)
- Metadata: `updatedAt`

### `app/meals/{mealId}` (one document per added meal)
- `name`, `quantity`, `unit`, `source`
- `logDate` (`YYYY-MM-DD`), `loggedAt`
- `nutrientSnapshot` (full nutrient map, including zero values)
- Metadata: `createdAt`, `updatedAt`

### `app/dailyLogs/{YYYY-MM-DD}` (one document per day)
- `date`
- `consumedNutrients` (full nutrient map)
- `mealCount` (optional but recommended)
- `notes` (optional)
- Metadata: `createdAt`, `updatedAt`
- No `completionScore`

## 2) Core write flow

When user adds meal, use a transaction:
1. Create meal doc in `app/meals`
2. Read/create `app/dailyLogs/{logDate}`
3. Add meal nutrient values into `dailyLogs.consumedNutrients` key-by-key
4. Increment `mealCount`
5. Update timestamps

## 3) Read flow

Dashboard reads:
- `app/userProfile.requiredNutrients`
- today’s `app/dailyLogs/{today}`

UI computes percentages client-side only when needed.

## 4) Data rules / consistency

- Always use nutrient key list from `src/config/nutrients.json`
- Always store full nutrient maps (missing keys default to `0`)
- Keep units consistent with config (`g`, `mg`, `mcg`, `ml`, `kcal`)

## 5) Future-safe extensions

- Meal edit/delete: reverse or recalc daily totals in transaction
- Weekly/monthly analytics from `dailyLogs` without scanning all meals
