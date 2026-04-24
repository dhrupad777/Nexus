@AGENTS.md

# Project Context: Nexus

## What this project is
- Nexus is a Next.js app for verified NGO and organization workflows: onboarding, dashboards, tickets, agreements, and audit-oriented operations.
- It uses Firebase as the backend platform (Auth, Firestore, Storage, Functions) with local emulator support for development.

## Tech stack
- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS.
- Data + auth: Firebase Web SDK (`firebase`), Firebase Admin SDK in server/cloud functions.
- Validation and forms: Zod + React Hook Form.
- Server logic: Firebase Cloud Functions (2nd gen), region `asia-south1`.
- Testing: Vitest (Firestore rules tests in `tests/rules`).

## Project structure (high signal)
- `app/`: App Router routes and UI pages.
- `app/(app)/`: authenticated app area (`dashboard`, `tickets`, `profile`, `onboard`).
- `app/(auth)/`: login/signup pages.
- `app/api/onboarding/chat/route.ts`: API route used by onboarding chat flow.
- `functions/src/`: Cloud Functions handlers, split into `callables`, `triggers`, and `scheduled` jobs.
- `lib/firebase/`: Firebase client/admin initialization.
- `lib/auth/`: auth helpers and post-login routing.
- `lib/schemas/`: shared Zod schema definitions.
- `tests/rules/`: Firestore security rules tests.

## Runtime and workflow notes
- Primary local dev command: `npm run dev`.
- `npm run dev` starts Next.js plus Firebase Auth emulator through `scripts/dev.mjs`.
- Web-only mode: `npm run dev:web`.
- Full emulator stack: `npm run dev:emulators:all`.
- Rules tests: `npm run test:rules` (or `npm run emu:rules` for emulator-backed execution).

## Firebase and environment assumptions
- Firebase project ID defaults to `buffet-493105` when not overridden.
- Client SDK reads `NEXT_PUBLIC_FIREBASE_*` env vars from runtime environment.
- Functions emulator is wired on port `5001`; Auth `9099`; Firestore `8080`; Storage `9199` when emulator mode is enabled.

## Development conventions for edits
- Keep changes minimal and scoped; avoid unrelated refactors.
- Preserve existing route group structure under `app/`.
- Reuse existing utility/schema modules in `lib/` before adding new abstractions.
- For backend changes, prefer adding logic in `functions/src/<area>/...` and exporting via `functions/src/index.ts`.
- For form/data changes, align updates across UI, schemas, and callable/API payloads.

## Safety and compatibility notes
- This repo uses Next.js `16.2.4` and may include API behavior different from older Next.js versions.
- Before introducing or changing framework-specific APIs, verify against docs in `node_modules/next/dist/docs/` and heed deprecations.
