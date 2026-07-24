# Piyasa Masası AI — Organization Charter

## Purpose

This charter defines how work on Piyasa Masası AI is organized, reviewed, and gated, replacing informal "just ship it" development with role-based separation of duties, traceable decisions, and mandatory independent review before anything reaches a real user or real money.

## How this is actually implemented (read this before the role list)

The roles below are **process roles**, not independent persistent software agents running unattended. In practice, all work in this repository is produced by an AI coding assistant (Claude Code) operating in a single working session per role-pass, under direct supervision of the project owner. What the roles buy you:

- A **named checklist and authority boundary** for each function (e.g. "Financial Validation" cannot be waved through by whoever wrote the calculation).
- A **documented separation-of-duties rule** (`authority-matrix.yaml`) that is checked before anything is marked Closed in `docs/REMEDIATION_REGISTER.md`.
- A **paper trail**: every role's output lives in a specific folder (see `organization-chart.yaml`), so a reviewer — human or a later AI session acting as reviewer — can check work without re-deriving it.

Claiming that fully autonomous, mutually-unaccountable AI agents are independently running a company with no human in the loop would be false; this charter instead operationalizes the separation-of-duties requirement through documentation, folder structure, and gate checklists that any reviewer (the owner, or a later session explicitly tasked with review) must walk through before a P0/P1 item or a release is marked done.

## Executive roles (accountability + escalation boundaries, not separate runtimes)

| Role | Owns | Cannot do |
|---|---|---|
| CEO (program) | Overall status reporting, sequencing, owner communication | Cannot approve its own P0 fixes as "tested" without evidence in `docs/TEST_EVIDENCE.md` |
| CPO (product) | PRD, scope, MVP definition (`product/`) | Cannot override a Compliance or Risk finding |
| CTO (technology) | Architecture, stack choices (`architecture/`) | Cannot skip Financial Validation on calculation changes |
| CMDO (market & data) | Data source quality, provenance, freshness | Cannot mark data "verified" without a source timestamp |
| CRCO (risk & compliance) | Regulatory register, prohibited-language enforcement (`compliance/`) | Cannot be overridden by Product or Executive for schedule reasons |
| CQSO (quality & security) | Test strategy, security findings (`quality/`) | Cannot close its own security findings — needs independent verification pass |
| COO (operations) | CI/CD, releases, cost control (`operations/`) | Cannot deploy with a failed or missing quality gate |

## Separation-of-duties rule enforced in this repo

A fix and its acceptance evidence are written in the same pass by necessity (single assistant), but the **acceptance criteria are fixed in advance** in `docs/REMEDIATION_REGISTER.md` / the audit report, and are not edited after the fact to make a fix look passing. Where the master instruction calls for "independent approval," the enforced substitute is: acceptance criteria defined before implementation, evidence recorded in `docs/TEST_EVIDENCE.md`, and an explicit reviewer pass (a separate session or the owner) before a P0 item is marked Closed — never same-pass self-certification without evidence.

## Escalation to the project owner

Per the controlling instruction, the owner is only asked about: unavoidable external cost, identity/account ownership, legally binding agreements, and payment. Everything else — including this session's current blocker (GitHub CLI not installed) — is surfaced as a specific, minimal action request, not a design or technical question. See `escalation-policy.md`.
