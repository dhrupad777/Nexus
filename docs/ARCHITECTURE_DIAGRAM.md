# Architecture Diagram Of The Proposed Solution

Nexus uses a Next.js web app with Firebase as the application backend. Firebase Auth handles identity, Firestore stores operational data, Firebase Storage stores verification and proof images, Cloud Functions enforce sensitive workflows, and Gemini APIs power onboarding assistance plus semantic matching.

## High-Level Architecture

```mermaid
flowchart TB
  subgraph Users["Users"]
    Visitor["Public visitor"]
    OrgUser["Organization admin / member"]
    Contributor["Contributor organization"]
    Host["Host organization"]
    Admin["Platform admin"]
  end

  subgraph Client["Client Layer"]
    Browser["Web browser"]
    NextUI["Next.js app router UI"]
    PublicPages["Public SSR / ISR pages"]
    ProtectedPages["Authenticated dashboard pages"]
  end

  subgraph Firebase["Firebase Backend"]
    Auth["Firebase Auth\nEmail, Google SSO, custom claims"]
    Firestore["Cloud Firestore\nusers, organizations, resources, tickets,\nmatches, contributions, signoffs, badges"]
    Storage["Firebase Storage\norganization docs and ticket photo proofs"]
    Rules["Firestore + Storage Security Rules"]
  end

  subgraph Server["Server Logic"]
    ApiRoutes["Next.js API routes\nonboarding chat, admin bootstrap/approve"]
    Functions["Cloud Functions v2\ncallables, triggers, scheduled jobs"]
    CallableFns["Callable functions\nraiseTicket, pledge, approveOrg,\ncreateResource, advancePhase, recordSignoff"]
    Triggers["Firestore / Storage triggers\nembedding, matching, proof updates,\naudit logs, badge minting"]
    Schedulers["Scheduled jobs\nexpiry, stuck-stage, reliability sweeps"]
  end

  subgraph AI["AI And External Services"]
    GeminiChat["Gemini chat\nonboarding assistant"]
    GeminiEmbed["Gemini embeddings\nresource and ticket vectors"]
  end

  Visitor --> Browser
  OrgUser --> Browser
  Contributor --> Browser
  Host --> Browser
  Admin --> Browser

  Browser --> NextUI
  NextUI --> PublicPages
  NextUI --> ProtectedPages

  ProtectedPages --> Auth
  ProtectedPages --> Firestore
  ProtectedPages --> Storage
  ProtectedPages --> Functions
  PublicPages --> Firestore
  PublicPages --> Storage

  Auth --> Rules
  Rules --> Firestore
  Rules --> Storage

  NextUI --> ApiRoutes
  ApiRoutes --> GeminiChat
  ApiRoutes --> Firestore
  ApiRoutes --> Auth

  Functions --> CallableFns
  Functions --> Triggers
  Functions --> Schedulers

  CallableFns --> Firestore
  CallableFns --> Auth
  CallableFns --> Storage
  Triggers --> Firestore
  Triggers --> Storage
  Triggers --> GeminiEmbed
  Schedulers --> Firestore

  GeminiEmbed --> Triggers
  GeminiChat --> ApiRoutes
```

## Core Data And Control Flow

```mermaid
flowchart LR
  Signup["Sign up / login"] --> Auth["Firebase Auth"]
  Auth --> UserDoc["users/{uid}"]

  UserDoc --> Onboard["Onboarding form or chat"]
  Onboard --> OrgDoc["organizations/{uid}\nPENDING_REVIEW"]
  Onboard --> GovtDocs["Storage: govt docs"]

  OrgDoc --> AdminReview["Platform admin review"]
  AdminReview --> Approve["approveOrg callable"]
  Approve --> ActiveOrg["organizations/{orgId}\nACTIVE + custom claims"]

  ActiveOrg --> ResourceForm["Resource management"]
  ResourceForm --> CreateResource["createResource callable"]
  CreateResource --> ResourceDoc["resources/{resourceId}"]
  ResourceDoc --> ResourceTrigger["onResourceCreated / onResourceUpdated"]
  ResourceTrigger --> ResourceVector["Gemini embedding"]
  ResourceVector --> ResourceReady["embeddingStatus: ok"]

  ActiveOrg --> TicketForm["Raise ticket"]
  TicketForm --> RaiseTicket["raiseTicket callable"]
  RaiseTicket --> TicketDoc["tickets/{ticketId}\nOPEN_FOR_CONTRIBUTIONS"]
  TicketDoc --> TicketTrigger["onTicketCreated / onRapidTicketCreated"]
  TicketTrigger --> TicketVector["Gemini embedding"]
  ResourceReady --> MatchEngine["Matching engine"]
  TicketVector --> MatchEngine
  MatchEngine --> MatchDocs["matches/{ticketId__orgId}"]

  MatchDocs --> Dashboard["Recommended dashboard"]
  Dashboard --> Pledge["pledge callable"]
  Pledge --> Contribution["tickets/{id}/contributions/{cid}"]
  Contribution --> Inventory["reservedQuantity / progress updates"]
  Inventory --> ActiveTickets["Active tickets dashboard"]

  ActiveTickets --> Execution["advancePhase to EXECUTION"]
  Execution --> ProofUpload["Upload photo proof"]
  ProofUpload --> ProofStorage["Storage: photo proof"]
  ProofUpload --> ProofDoc["tickets/{id}/photoProofs/{pid}"]
  ProofDoc --> PendingSignoff["advancePhase to PENDING_SIGNOFF"]

  PendingSignoff --> Signoff["recordSignoff callable"]
  Signoff --> SignoffDoc["tickets/{id}/signoffs/{orgId}"]
  SignoffDoc --> CloseTrigger["onSignoffRecorded"]
  CloseTrigger --> ClosedTicket["tickets/{id}: CLOSED"]
  ClosedTicket --> BadgeTrigger["onTicketClosed"]
  BadgeTrigger --> Badges["badges/{ticketId__orgId}"]
  BadgeTrigger --> FinalInventory["Commit or refund inventory"]
  Badges --> PublicImpact["Public ticket page and org profile"]
```

## Component Responsibilities

| Layer | Component | Responsibility |
| --- | --- | --- |
| Client | Next.js app router | Public pages, auth pages, dashboard, tickets, resources, profile, admin console |
| Auth | Firebase Auth | Login, Google SSO, identity tokens, custom claims for `orgId` and platform admin role |
| Data | Cloud Firestore | Source of truth for organizations, resources, tickets, matches, contributions, signoffs, badges, audit logs |
| Files | Firebase Storage | Government documents and ticket photo proof uploads |
| Backend | Cloud Functions callables | Server-authoritative validation and mutations for approval, resources, tickets, pledges, phase changes, signoffs |
| Backend | Cloud Functions triggers | Embeddings, matching, audit logs, photo-proof updates, close detection, badge minting, inventory commit/refund |
| AI | Gemini API | Onboarding chat and semantic embeddings for resources and tickets |
| Security | Firestore and Storage rules | Prevent unauthorized reads/writes, enforce user/org ownership, keep server-only fields protected |
| Public proof | SSR / ISR public pages | Render closed tickets, impact stories, public badges, and organization profiles |

## Deployment View

```mermaid
flowchart TD
  Dev["Developer workspace"] --> Git["Git repository"]
  Git --> AppHosting["Firebase App Hosting\nNext.js frontend"]
  Dev --> FunctionsDeploy["Firebase Functions deploy"]

  AppHosting --> NextRuntime["Next.js runtime"]
  FunctionsDeploy --> CloudFunctions["Cloud Functions v2\nasia-south1"]

  NextRuntime --> FirebaseProject["Firebase project"]
  CloudFunctions --> FirebaseProject

  FirebaseProject --> Auth["Firebase Auth"]
  FirebaseProject --> Firestore["Cloud Firestore"]
  FirebaseProject --> Storage["Firebase Storage"]
  CloudFunctions --> Gemini["Gemini API"]
```

