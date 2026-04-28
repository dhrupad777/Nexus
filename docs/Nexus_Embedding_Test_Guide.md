# Nexus — Vector Embedding Validation & Testing Guide

## Purpose
This document defines a controlled test to validate whether **Vertex AI embeddings (semantic matching)** improve resource–ticket matching in Nexus.

The goal is to:
- Verify embeddings generate meaningful similarity
- Compare embedding-based matching vs rule-based matching
- Ensure integration works without modifying existing logic

---

## Pre-Check (Do NOT Skip)

Before running tests, ensure:

- Vertex AI API is configured
- Embedding function is callable from backend
- Firestore schema supports storing embedding vectors
- Existing matching logic remains unchanged

If any of the above is missing → STOP and fix before proceeding

---

## Test Dataset Setup

Create controlled test data:

### Resources
- Food distribution resource
- Logistics transport resource
- Medical aid resource

### Tickets
- Food relief request
- Transport requirement
- Medical emergency support

Ensure:
- Some matches are obvious (direct match)
- Some matches are indirect (semantic match)

---

## Step 1 — Generate Embeddings

For each resource and ticket:

- Combine fields into a single text string:
  - category + subtype + description

Example:
"Food distribution for disaster relief with 500 meal capacity"

- Pass this text into Vertex AI embedding model
- Store resulting vector in Firestore

Verify:
- Each entity has a non-empty embedding array

---

## Step 2 — Similarity Calculation

Implement similarity check using:

- Cosine similarity (preferred)

Test cases:
- Food resource vs food ticket → HIGH similarity
- Food resource vs logistics ticket → LOW similarity

Expected:
- Correct ranking order based on relevance

---

## Step 3 — Compare With Rule-Based Matching

Run both systems:

### Rule-Based Matching
- category match
- location filter

### Embedding-Based Matching
- semantic similarity score

Compare:
- Accuracy of recommendations
- Ability to detect indirect matches

---

## Step 4 — Dashboard Validation

Verify:
- Recommended tickets change when embeddings are used
- Better ranking vs basic filtering
- No irrelevant recommendations

---

## Step 5 — Performance Check

Measure:
- Time to generate embeddings
- Query latency

Ensure:
- Acceptable performance
- No blocking UI issues

---

## Step 6 — Edge Case Testing

Test:
- Empty descriptions
- Very similar categories
- Completely unrelated data

Expected:
- Stable results
- No crashes

---

## Success Criteria

Embedding system is valid if:

- Improves recommendation accuracy
- Detects semantic similarity beyond exact matches
- Does not degrade performance significantly
- Integrates without breaking existing flow

---

## Failure Conditions

System is NOT valid if:

- Results are random or inconsistent
- No improvement over rule-based matching
- High latency or cost overhead
- Breaks existing matching logic

---

## Rollback Strategy (Dormant)

If production issues occur:

- Disable embedding-based ranking
- Revert to rule-based filtering
- Keep embeddings stored (no data loss)

---

## Final Output

At the end of this test, system should clearly indicate:

- Whether embeddings improve matching quality
- Whether this method should be used in production

---

## One-Line Summary

This test validates whether semantic embeddings provide meaningful, scalable improvements to Nexus resource matching.
