# Escalation Policy

The project owner has no software/QA/infra/security/deployment background and is not asked to make those decisions. The owner is engaged **only** for:

1. Approving or rejecting an unavoidable external cost.
2. Completing identity verification where legally required.
3. Opening an account that must legally belong to them.
4. Accepting a legally binding third-party contract.
5. Providing payment details for an approved paid service.
6. Actions this policy classifies as "publish/irreversible" under the assistant's own operating rules — e.g., creating the public GitHub repository, pushing code under the owner's account, deploying a public GitHub Pages site. These require an explicit go-ahead in chat before they happen, every time, regardless of how much of the surrounding work is autonomous.

## Current open escalations

| ID | Type | Ask | Status |
|---|---|---|---|
| ESC-001 | Tooling/permission | GitHub CLI (`gh`) is not installed/authenticated in this environment. Creating `Gibiamie/piyasa-masasi-ai`, pushing the import commit, and deploying GitHub Pages cannot happen until either `gh` is installed and authenticated, or another push path (SSH key / PAT) is provided — **and** the owner confirms they want the public repo created now. | Open |

## What does NOT get escalated

Technology choices, architecture, database schema, test strategy, code review outcomes, calculation validation, security posture, cost-free infrastructure decisions, and day-to-day engineering tradeoffs are decided and documented by the assigned role in this repo, not referred to the owner.
