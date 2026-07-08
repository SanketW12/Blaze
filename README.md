# Blaze

Blaze is a React + Firebase nutrition app with an AI chat assistant, meal logging, nutrient tracking, PWA install support, and biometric app lock.

## Tech Stack

- React 19 + TypeScript
- Vite 7 + Tailwind CSS 4
- Zustand (persisted app state)
- Firebase (profile, daily log, meals)
- OpenAI Responses/Conversation APIs
- `vite-plugin-pwa` for installable app behavior

## Features

- Dashboard with nutrient progress and meal log
- Expandable meal items with nutrient snapshots
- Profile modal and dashboard refresh action
- Chat assistant with:
  - Conversation mode and Responses mode
  - Markdown rendering
  - Image attachment support
  - Meal mode JSON output + add meal to Firebase
  - Optional profile-context injection in prompts
- Installable PWA (including iOS home screen support)
- Startup splash screen while app boots
- App lock gate using device biometric auth (Face ID / Touch ID / platform authenticator)

## Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Create a `.env` file in project root:

```env
# Firebase (public web config)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=

# Frontend -> Netlify Function (optional override)
VITE_CHAT_FUNCTION_URL=/.netlify/functions/chat

# Local dev fallback only (never set these in Netlify UI)
VITE_API_KEY=
VITE_THREAD_ID=
VITE_ASSISTANT_ID=
VITE_OPENAI_MODEL=gpt-4.1-mini
VITE_OPENAI_MAX_OUTPUT_TOKENS=1000
```

Notes:

- Production OpenAI secrets belong in **Netlify UI → Site settings → Environment variables** (server-side only, no `VITE_` prefix).
- Local fallback: with plain `npm run dev`, if `/.netlify/functions/chat` is unavailable, the app can use the `VITE_*` OpenAI keys in development only.

### 3) Run locally

```bash
npm run dev
```

Default dev server: `http://localhost:3000`

For local testing of Netlify Functions, use `netlify dev` if you want `/.netlify/functions/*` routes available.

## Scripts

- `npm run dev` - Start Vite dev server
- `npm run build` - Type-check + build
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - TypeScript check
- `npm run test` - Format check + lint + type-check

## PWA / Icons

PWA is configured in `vite.config.ts` and `public/manifest.webmanifest`.

Expected icon assets:

- `blaze_dark_icon_152x152.png`
- `blaze_dark_icon_180x180.png`
- `blaze_dark_icon_192x192.png`
- `blaze_dark_icon_512x512.png`
- `blaze_dark_icon_1024x1024.png`

Place these in `public/` so favicon, manifest, and social tags resolve correctly.

## Storage Notes

Zustand persists app state under `nutritrack-app-store-v1`.

To avoid localStorage quota issues when sending chat images:

- Raw `imageDataUrl` is intentionally not persisted in chat metadata
- Persisted chat history is sanitized and capped

If you still hit stale quota once after upgrade, clear site storage and reload.

## Netlify Deploy Notes

- Chat requests are served by `netlify/functions/chat.ts`.
- `netlify.toml` sets `SECRETS_SCAN_OMIT_KEYS` for Firebase public config keys.
- Keep secrets scanning enabled.
- Set these in **Netlify UI → Site settings → Environment variables** (server-side only):

```env
OPENAI_API_KEY=
OPENAI_THREAD_ID=
OPENAI_ASSISTANT_ID=
OPENAI_MODEL=gpt-4.1-mini
OPENAI_MAX_OUTPUT_TOKENS=1000
```

- Optional alias: `OPENAI_CONVERSATION_ID` (used instead of `OPENAI_THREAD_ID` when both are set).
- Do **not** add `VITE_API_KEY`, `VITE_THREAD_ID`, or other `VITE_*` OpenAI keys to Netlify UI — they would be bundled into the client.

## App Lock Behavior

- App opens behind lock/setup gate first
- Unlock uses device-level platform authenticator (Face ID / Touch ID / equivalent)
- If unsupported in current browser context, UI shows an availability hint

## Project Structure

- `src/app` - shell, providers, app-level gating
- `src/features/Dashboard` - dashboard UI and nutrient/meal views
- `src/features/Chat` - chat page + OpenAI integration service
- `src/firebase` - Firestore data services
- `src/store` - Zustand app store
- `src/config` - nutrient config and meal schema

## License

MIT
