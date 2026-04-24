# Nexus — Ticket Display & Interaction Specification

## 1. Purpose

Defines:

- Data displayed for each ticket  
- Logic behind ticket recommendations and participation  
- Behavior for Non-Rapid and Rapid modes  

This document focuses on **logic and data**, not UI layout.

---

## 2. Ticket Modes

### 2.1 Non-Rapid Mode
- Planned execution  
- Structured contributions  
- Pre-validation required  

### 2.2 Rapid Mode
- Emergency response  
- Immediate commitment  
- Post-action verification  

---

## 3. Ticket Data Model (Display Layer)

### 3.1 Core Fields
- title  
- category  
- subtype  
- description  
- location (with distance from entity)  
- host_entity  
- host_verification_status  

### 3.2 Requirement Fields
- total_required  
- total_fulfilled  
- total_remaining  
- completion_percentage  

### 3.3 Contribution Context (Per Entity)
- max_contribution_possible  
- contribution_feasibility (boolean)  
- contribution_impact_percentage  

### 3.4 Participation Data
- contributors_list  
- contributor_count  

### 3.5 Status Fields
- ticket_status (OPEN / ACTIVE / COMPLETED)  
- phase (PLANNING / EXECUTION / COMPLETION)  
- urgency_level  

### 3.6 Optional Fields
- timeline (start_date, expected_completion)  
- execution_plan  
- proof_updates  

---

## 4. Non-Rapid Ticket Logic

### 4.1 Display Logic
- requirement vs fulfillment  
- remaining requirement  
- entity-specific contribution potential  
- contribution impact  

### 4.2 Contribution Logic
Contribution allowed only if:
- entity is verified  
- entity has matching resource  
- available capacity > 0  

### 4.3 Contribution Flow
View → Evaluate → Contribute → Agreement → Execution → Proof → Close  

### 4.4 Agreement Handling
- Agreement must be generated before final confirmation  
- Both host and contributor must approve  

---

## 5. Rapid Ticket Logic

### 5.1 Core Principle
Commit first, verify after (with accountability)

### 5.2 Display Logic
- urgency  
- remaining requirement  
- immediate deployable capacity  

### 5.3 Contribution Logic
Contribution allowed if:
- entity is verified  
- rapid_enabled = true  
- rapid_capacity > 0  

### 5.4 Rapid Flow
Respond → Reserve → Deploy → Verify → Close  

### 5.5 Verification (Post-Action)
- host confirms usage  
- contributor confirms delivery  

### 5.6 Agreement Handling
- Agreement generated after commitment  
- Must be approved before closure  

---

## 6. Personalized Recommendation Logic

### 6.1 Filtering
- category/subtype match  
- geo proximity  
- availability  
- status = OPEN  

### 6.2 Capacity Check
entity_capacity ≥ minimum_requirement  

### 6.3 Semantic Matching
similarity(ticket, resource)  

### 6.4 Ranking
finalScore = semantic_score + geo_score + urgency_score + capacity_fit  

### 6.5 Exclusions
- already joined tickets  
- declined tickets  

---

## 7. Host Control Logic

### 7.1 Authority
Host controls:
- execution  
- validation  
- closure  

### 7.2 Actions
- update fulfilled quantity  
- upload proof  
- manage contributions  
- move ticket phase  
- close ticket  

### 7.3 Closure Conditions
- required resources fulfilled  
- contributors confirm usage  

### 7.4 Logging
All actions must be logged.

---

## 8. System Rules

### 8.1 General
- no anonymous participation  
- only verified entities  
- all contributions tracked  

### 8.2 Non-Rapid
- validation before execution  
- agreement required before action  

### 8.3 Rapid
- execution before validation  
- validation required after action  

---

## 9. Design Guidance (Non-Mandatory)

- highlight urgency with tags/icons  
- show decision-critical data only  
- avoid overload  
- prioritize personalization  

---

## 10. Final Definition

Tickets are structured problem units with dynamic contribution intelligence and dual execution modes.

---

## 11. Summary

Each ticket shows what is needed, what the user can do, and how to act.
