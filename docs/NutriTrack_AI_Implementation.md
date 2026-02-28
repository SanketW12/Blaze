# NutriTrack AI --- Production Implementation Specification

## 1. Product Vision

NutriTrack AI is a personal AI-powered nutrition intelligence
Progressive Web App (PWA) that:

-   Tracks daily nutrient intake automatically
-   Uses AI to parse meals from text and images
-   Calculates nutrients vs daily requirements
-   Provides a real-time dashboard
-   Offers an AI nutrition/fitness assistant chat
-   Works offline-first
-   Uses Firebase backend and OpenAI assistants

This document is intended for an AI coding agent or engineering team to
implement a full production-ready system.

------------------------------------------------------------------------

## 2. Core Architecture

### Frontend

-   React + Vite PWA
-   TypeScript
-   shadcn UI component system
-   Zustand state management
-   IndexedDB offline cache
-   Service worker via vite-plugin-pwa

### Backend

-   Firebase Firestore database
-   Firebase Cloud Functions (AI proxy)
-   Firebase Storage for images (optional)

### AI Services

-   OpenAI Assistants API
-   Vision model for food images
-   Nutrition assistant context model

------------------------------------------------------------------------

## 3. System Modules

### Nutrient Engine

Responsible for:

-   Mapping foods → nutrients
-   Aggregating daily totals
-   Computing completion score
-   Detecting deficiencies

### AI Food Parser

Input:

-   Text meal descriptions
-   Meal photos

Output:

JSON structured food objects.

### Dashboard Engine

Displays:

-   Daily nutrient score
-   Remaining nutrients
-   Trends
-   Deficiency alerts

### AI Chat Assistant

Capabilities:

-   Nutrition guidance
-   Fitness recovery tips
-   Diet improvement suggestions
-   Supplement information

------------------------------------------------------------------------

## 4. Folder Structure

    /nutritrack-ai
      /public
      /src
        /components
        /pages
          Dashboard
          AddMeal
          Chat
          Profile
        /store
        /services
        /config
        /hooks
        /utils
      /functions

------------------------------------------------------------------------

## 5. Environment Variables

    VITE_FIREBASE_API_KEY
    VITE_FIREBASE_AUTH_DOMAIN
    VITE_FIREBASE_PROJECT_ID
    VITE_FIREBASE_STORAGE_BUCKET
    VITE_FIREBASE_MESSAGING_SENDER_ID
    VITE_FIREBASE_APP_ID
    OPENAI_API_KEY
    OPENAI_ASSISTANT_FOOD_ID
    OPENAI_ASSISTANT_CHAT_ID

OpenAI keys must never be exposed to the client.

Always route AI requests through Firebase Cloud Functions.

------------------------------------------------------------------------

## 6. Nutrient Master File

Location:

    /src/config/nutrients.json

Purpose:

-   Nutrient definitions
-   Units
-   Categories
-   Default recommended daily values
-   Dashboard priority

Must remain static and version-controlled.

User overrides go to database.

------------------------------------------------------------------------

## 7. Database Collections

### user_profile (collection/document)

Stores:

-   Age
-   Weight
-   Height
-   Activity level
-   BMI
-   BMR
-   Required nutrients JSON

### daily_logs (collection/documents)

Stores:

-   Date
-   Consumed nutrient JSON
-   Completion score
-   Notes

### meal_entries (collection/documents)

Stores:

-   Food name
-   Nutrient snapshot
-   Quantity
-   Source (text/image)
-   Timestamp

### chat_history (optional collection)

Stores AI conversation history.

------------------------------------------------------------------------

## 8. AI Assistants

### Food Extraction Assistant

System instructions:

-   Extract foods from text/image
-   Return strict JSON
-   No explanations
-   No nutrient calculation

Example output:

{ "foods":\[ {"name":"egg","quantity":2,"unit":"piece"} \] }

### Nutrition Chat Assistant

Focus:

-   Evidence-based nutrition
-   Healthy diet guidance
-   Fitness recovery
-   Lifestyle optimization

Avoid:

-   Medical diagnosis
-   Extreme diets

------------------------------------------------------------------------

## 9. Nutrient Calculation Logic

Primary formula:

    nutrient_total = per100g_value × quantity/100

Daily score:

    score = average(min(consumed/required,1)) × 100

Rules:

-   Cap excess at 100%
-   Preserve historical snapshots
-   Never recalc past logs after requirement change

------------------------------------------------------------------------

## 10. Frontend Pages

### Dashboard

-   Nutrient progress bars
-   Completion score
-   Remaining nutrients
-   Trend insights

### Add Meal

-   Text input
-   Image upload
-   AI parsing
-   Nutrient confirmation

### AI Chat

-   Persistent conversation
-   Nutrition assistant

### Profile

-   Weight, height, activity
-   Requirement recalculation

------------------------------------------------------------------------

## 11. State Management

Recommended Zustand store:

-   userProfile
-   dailyLog
-   meals
-   chatHistory
-   loading states

Persist critical state locally.

------------------------------------------------------------------------

## 12. PWA Implementation

Requirements:

-   Installable
-   Offline caching
-   Background sync
-   IndexedDB fallback

Cache:

-   Nutrient config
-   Daily logs
-   Static assets

------------------------------------------------------------------------

## 13. Firebase Cloud Function Design

Purpose:

-   Hide OpenAI keys
-   Process AI calls
-   Normalize responses
-   Update database

Flow:

Frontend → Cloud Function → OpenAI → Firestore → Response

------------------------------------------------------------------------

## 14. Security Requirements

-   Enable Firestore Security Rules
-   Validate AI responses
-   Protect API keys
-   Sanitize inputs
-   Prevent JSON injection

------------------------------------------------------------------------

## 15. Offline Strategy

When offline:

-   Store meals locally
-   Queue API calls
-   Sync on reconnect

Conflict resolution:

-   Last-write-wins acceptable for single user.

------------------------------------------------------------------------

## 16. Performance Considerations

-   Avoid recalculating nutrients repeatedly
-   Use aggregated daily totals
-   Cache nutrient master file
-   Lazy-load charts

------------------------------------------------------------------------

## 17. Observability

Optional but recommended:

-   Firebase logs
-   Error tracking (Sentry)
-   Usage metrics

------------------------------------------------------------------------

## 18. Future Extensions

### Short Term

-   Supplement tracking
-   Voice meal logging
-   Barcode scanning

### Mid Term

-   Blood test integration
-   AI deficiency predictions

### Long Term

-   Multi-user SaaS
-   Wearable integration

------------------------------------------------------------------------

## 19. Deployment

Frontend:

-   Vercel / Netlify

Backend:

-   Firebase managed services (Firestore, Auth, Storage)

Cloud Functions:

-   Firebase CLI deployment

------------------------------------------------------------------------

## 20. Success Criteria

App is successful if:

-   Food logging \< 10 seconds
-   Nutrient gaps visible daily
-   AI assistant helpful
-   Offline experience smooth

------------------------------------------------------------------------

## Engineering Philosophy

Build simple first.

Optimize later.

Focus on:

-   Low friction
-   Accurate nutrients
-   Clean UX
-   Reliable AI extraction

Avoid:

-   Overengineering
-   Premature analytics
-   Excess complexity

------------------------------------------------------------------------
