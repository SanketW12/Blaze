# Chat Tab Specification

## Purpose

The Chat tab provides a persistent AI nutrition and fitness assistant for practical guidance and follow-up questions.

Core outcomes:

- Persistent conversation history
- Reliable nutrition/fitness guidance
- Safe and bounded assistant behavior
- Offline-safe message queueing

## UI Scope

Required sections:

- Message history list
- Message composer/input
- Send action with loading state
- Network/queue status
- Error and queued state feedback

Design requirements:

- Mobile-first chat experience
- shadcn UI components only
- Dark theme consistent with app

## AI Integration

Uses OpenAI Assistants API directly from client (current setup choice).

Assistant focus:

- Evidence-based nutrition
- Healthy diet guidance
- Fitness recovery
- Lifestyle optimization

Assistant must avoid:

- Medical diagnosis
- Extreme diets

Runtime flow:

Frontend -> OpenAI Assistants API -> local persisted `chatHistory` -> response

## Data and Persistence

Primary table:

- `chat_history` (optional in schema but enabled for persistent experience)

Expected data:

- role (`user` / `assistant`)
- content
- timestamps
- optional metadata (thread identifiers)

State dependencies (Zustand):

- `chatHistory`
- loading/error states

## Threading Behavior

Recommended behavior:

- Reuse latest assistant thread context when available
- Keep thread id in metadata for continuity
- Refresh full chat history after successful assistant response

## Offline and Queueing

When offline:

- Queue user messages locally in IndexedDB
- Display queued status
- Auto-send on reconnect in original order

Conflict policy:

- Last-write-wins acceptable for single-user context

## Security and Validation

- Validate message length and shape before send
- Sanitize message input
- Validate edge function response content
- Client-direct mode uses `VITE_OPENAI_API_KEY` in frontend bundle (insecure by design for current setup). Move to server/edge function before production.

## Success Criteria (Chat-specific)

- Conversation persists between sessions
- Guidance is useful and context-aware
- Offline queued messages sync reliably after reconnect
