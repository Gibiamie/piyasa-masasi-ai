# Cost Approval Policy

Before any paid service is requested, the assigned role must document, in this format, in `operations/cost-reports/`:

```text
COST DECISION ID:
Service or Purchase:
Purpose:
Why It Is Needed:
Required Now: YES / NO
Free Alternative:
Limitations of Free Alternative:
Recommended Option:
One-Time Cost:
Monthly Cost:
Estimated Annual Cost:
Scaling Risk:
Effect if Rejected:
AI Recommendation:
Owner Decision Required: APPROVE / REJECT
```

Rules:

- Prefer free/open-source tiers during early development (GitHub Pages, GitHub Actions free minutes, free-tier data providers where licensing allows).
- A rejected cost degrades or defers the affected feature; it never blocks unrelated work.
- No cost decision request may be vague ("which provider do you prefer?") — it must arrive fully worked with a recommendation already made.

## Current cost register

No paid services have been requested yet. GitHub (public repo + Pages + Actions minutes) is free for this use case. The only currently known future cost driver is a licensed BIST real-time/delayed data provider, which `backend/market-gateway` already gates behind `BIST_LICENSED_PROVIDER_REQUIRED` rather than silently proceeding without one.
