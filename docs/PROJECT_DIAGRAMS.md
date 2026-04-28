# Nexus Flow And Use Case Diagrams

Nexus is a verified organization-to-organization resource allocation platform. It connects approved NGOs and organizations, lets hosts raise resource tickets, uses AI-assisted matching to recommend contributor resources, tracks delivery proof, and publishes closed impact with badges.

## Project Flow Diagram

```mermaid
flowchart TD
  Public["Public visitor"]
  OrgAdmin["Organization admin"]
  PlatformAdmin["Platform admin"]
  Contributor["Contributor org"]
  Host["Host org"]

  Public --> PublicHome["View public home, active tickets, closed impact"]
  PublicHome --> PublicTicket["View public closed-ticket page"]
  PublicHome --> PublicOrg["View public org profile and badges"]

  OrgAdmin --> Auth["Sign up or log in"]
  Auth --> Onboarding["Create organization profile"]
  Onboarding --> Docs["Upload government documents"]
  Docs --> PendingOrg["organizations/{uid}: PENDING_REVIEW"]
  PendingOrg --> AdminQueue["Admin review queue"]
  PlatformAdmin --> AdminQueue
  AdminQueue --> ApproveOrg["approveOrg callable"]
  ApproveOrg --> ActiveOrg["ACTIVE org + custom claims"]

  ActiveOrg --> ManageResources["Manage resources"]
  ManageResources --> CreateResource["createResource / updateResource callables"]
  CreateResource --> ResourceDoc["resources/{id}: AVAILABLE"]
  ResourceDoc --> ResourceEmbedding["onResourceCreated / onResourceUpdated"]
  ResourceEmbedding --> GeminiResource["Gemini resource embedding"]
  GeminiResource --> MatchReadyResource["Embedded resource ready for matching"]

  ActiveOrg --> RaiseTicket["Raise ticket"]
  Host --> RaiseTicket
  RaiseTicket --> RaiseTicketCallable["raiseTicket callable"]
  RaiseTicketCallable --> TicketOpen["tickets/{id}: OPEN_FOR_CONTRIBUTIONS"]

  TicketOpen --> TicketCreatedTrigger["onTicketCreated"]
  TicketCreatedTrigger --> GeminiTicket["Gemini ticket embedding"]
  GeminiTicket --> NormalMatch["Normal flow: top-K ranked matches"]
  TicketOpen --> RapidTrigger["onRapidTicketCreated"]
  RapidTrigger --> RapidMatch["Emergency flow: rapid broadcast matches"]

  MatchReadyResource --> NormalMatch
  MatchReadyResource --> RapidMatch
  NormalMatch --> MatchDocs["matches/{ticketId__orgId}"]
  RapidMatch --> MatchDocs
  MatchDocs --> Recommended["Contributor dashboard: recommended tickets"]

  Contributor --> Recommended
  Recommended --> ViewTicket["View ticket detail"]
  ViewTicket --> Pledge["Pledge matching resource"]
  Pledge --> PledgeCallable["pledge callable"]
  PledgeCallable -->|Normal ticket| Proposed["Contribution: PROPOSED"]
  PledgeCallable -->|Emergency ticket| Committed["Contribution: COMMITTED"]

  Proposed --> HostDecision["Host approves or rejects pledge"]
  HostDecision --> RespondCallable["respondToPledge callable"]
  RespondCallable --> Committed
  Committed --> ReserveInventory["Reserve inventory, update progress, add participantOrgIds"]
  ReserveInventory --> ActiveTickets["Dashboard active tickets"]

  Host --> AdvanceExecution["Move ticket to EXECUTION"]
  AdvanceExecution --> AdvanceCallable1["advancePhase callable"]
  AdvanceCallable1 --> Execution["tickets/{id}: EXECUTION"]
  Execution --> UploadProof["Host uploads photo proof"]
  UploadProof --> Storage["Firebase Storage"]
  UploadProof --> ProofDoc["tickets/{id}/photoProofs/{proofId}"]
  ProofDoc --> ProofTrigger["onPhotoProofUploaded"]

  Host --> MarkComplete["Mark execution complete"]
  MarkComplete --> AdvanceCallable2["advancePhase callable"]
  AdvanceCallable2 --> PendingSignoff["tickets/{id}: PENDING_SIGNOFF"]

  Contributor --> Signoff["Approve or dispute delivery"]
  Signoff --> RecordSignoff["recordSignoff callable"]
  RecordSignoff --> SignoffDoc["tickets/{id}/signoffs/{orgId}"]
  SignoffDoc --> SignoffTrigger["onSignoffRecorded"]
  SignoffTrigger -->|All contributors approved| Closed["tickets/{id}: CLOSED"]
  SignoffTrigger -->|Any dispute| PendingSignoff

  Closed --> TicketClosedTrigger["onTicketClosed"]
  TicketClosedTrigger --> InventoryFinal["Commit or refund inventory"]
  TicketClosedTrigger --> BadgeDocs["badges/{ticketId__orgId}"]
  BadgeDocs --> OrgBadges["organizations/{orgId}.badges[]"]
  Closed --> PublicTicket
  BadgeDocs --> PublicOrg
```

## Use Case Diagram

```mermaid
flowchart LR
  Public["Public visitor"]
  OrgAdmin["Org admin"]
  ActiveOrg["Verified org"]
  Host["Host org"]
  Contributor["Contributor org"]
  PlatformAdmin["Platform admin"]
  System["Firebase functions + AI services"]

  subgraph Nexus["Nexus platform"]
    UC_PublicFeed(("View active tickets and impact feed"))
    UC_PublicTicket(("View closed ticket proof page"))
    UC_PublicOrg(("View organization profile and badges"))

    UC_Auth(("Sign up / log in"))
    UC_Onboard(("Onboard organization"))
    UC_UploadDocs(("Upload verification documents"))
    UC_Profile(("View profile, reliability, badges"))

    UC_ReviewOrgs(("Review pending organizations"))
    UC_ApproveOrg(("Approve organization"))

    UC_ManageResources(("Create, edit, delete resources"))
    UC_EmergencyOptIn(("Configure emergency resource contract"))
    UC_RaiseTicket(("Raise normal or emergency ticket"))
    UC_Dashboard(("View dashboard recommendations and active tickets"))
    UC_ViewTicket(("View ticket detail"))
    UC_Pledge(("Pledge resource to a ticket"))
    UC_RespondPledge(("Approve or reject proposed pledge"))
    UC_Advance(("Advance ticket phase"))
    UC_Proof(("Upload photo proof"))
    UC_Signoff(("Confirm or dispute delivery"))

    UC_EmbedResources(("Embed resources"))
    UC_EmbedTickets(("Embed tickets"))
    UC_Match(("Generate matches"))
    UC_Audit(("Append audit log"))
    UC_Close(("Auto-close fully signed ticket"))
    UC_Badges(("Mint public badges"))
    UC_Inventory(("Reserve, commit, or refund inventory"))
  end

  Public --> UC_PublicFeed
  Public --> UC_PublicTicket
  Public --> UC_PublicOrg

  OrgAdmin --> UC_Auth
  OrgAdmin --> UC_Onboard
  OrgAdmin --> UC_UploadDocs
  OrgAdmin --> UC_Profile

  PlatformAdmin --> UC_ReviewOrgs
  PlatformAdmin --> UC_ApproveOrg

  ActiveOrg --> UC_ManageResources
  ActiveOrg --> UC_EmergencyOptIn
  ActiveOrg --> UC_RaiseTicket
  ActiveOrg --> UC_Dashboard
  ActiveOrg --> UC_ViewTicket

  Host --> UC_RaiseTicket
  Host --> UC_RespondPledge
  Host --> UC_Advance
  Host --> UC_Proof

  Contributor --> UC_Dashboard
  Contributor --> UC_ViewTicket
  Contributor --> UC_Pledge
  Contributor --> UC_Signoff

  System --> UC_EmbedResources
  System --> UC_EmbedTickets
  System --> UC_Match
  System --> UC_Audit
  System --> UC_Close
  System --> UC_Badges
  System --> UC_Inventory

  UC_Onboard -. includes .-> UC_UploadDocs
  UC_ApproveOrg -. enables .-> UC_ManageResources
  UC_ManageResources -. triggers .-> UC_EmbedResources
  UC_RaiseTicket -. triggers .-> UC_EmbedTickets
  UC_EmbedTickets -. feeds .-> UC_Match
  UC_EmbedResources -. feeds .-> UC_Match
  UC_Match -. appears in .-> UC_Dashboard
  UC_Pledge -. updates .-> UC_Inventory
  UC_RespondPledge -. normal flow .-> UC_Inventory
  UC_Advance -. requires proof before signoff .-> UC_Proof
  UC_Signoff -. all approved .-> UC_Close
  UC_Close -. triggers .-> UC_Badges
  UC_Badges -. published on .-> UC_PublicTicket
  UC_Badges -. published on .-> UC_PublicOrg
```

## Architecture Context

```mermaid
flowchart TD
  Browser["Browser"]
  NextApp["Next.js app"]
  Auth["Firebase Auth"]
  Firestore["Cloud Firestore"]
  Storage["Firebase Storage"]
  Functions["Cloud Functions"]
  Gemini["Gemini API"]
  PublicSSR["Public SSR / ISR pages"]

  Browser --> NextApp
  NextApp --> Auth
  NextApp --> Firestore
  NextApp --> Storage
  NextApp --> Functions

  Functions --> Firestore
  Functions --> Storage
  Functions --> Gemini
  Functions --> Auth

  Firestore --> PublicSSR
  Storage --> PublicSSR
  PublicSSR --> Browser

  Functions --> ResourceTriggers["Resource embedding triggers"]
  Functions --> TicketTriggers["Ticket matching and lifecycle triggers"]
  Functions --> BadgeTriggers["Badge and inventory triggers"]

  ResourceTriggers --> Gemini
  TicketTriggers --> Gemini
  TicketTriggers --> Firestore
  BadgeTriggers --> Firestore
```

## Main Lifecycle States

```mermaid
stateDiagram-v2
  [*] --> PENDING_REVIEW: org submits onboarding
  PENDING_REVIEW --> ACTIVE: platform admin approves

  state ACTIVE {
    [*] --> ResourceListed: create resource
    ResourceListed --> ResourceEmbedded: embedding ok

    [*] --> OPEN_FOR_CONTRIBUTIONS: raise ticket
    OPEN_FOR_CONTRIBUTIONS --> EXECUTION: host advances after committed pledges
    EXECUTION --> PENDING_SIGNOFF: host uploads proof and marks complete
    PENDING_SIGNOFF --> CLOSED: all contributors approve
    PENDING_SIGNOFF --> PENDING_SIGNOFF: contributor disputes
    CLOSED --> [*]: badges visible publicly
  }
```
