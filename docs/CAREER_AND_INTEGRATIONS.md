# Amicus v0.5 — Career & Personal Operations

This release adds real local persistence and independent actions across public opportunity discovery, personal contacts, tasks, Minto-style drafting, speaker candidate research, and optional Gmail / Google Calendar adapters. Everything remains **single-student and local-first**.

## What is real versus conditional

| Workflow | Functionality | Important boundary |
|---|---|---|
| Texas Law events | Official, public .ics feed sync through `https://law.utexas.edu/calendar/feed/ics/` | Internet required; the feed may be unavailable from the student's network; only calendar entries supplied by source appear |
| Any school with public iCalendar | Import .ics from school site, or configure an approved school feed hostname in `.env` | No automatic discovery of unknown school's feed URL; imported entries do not claim verification |
| Personal opportunity matching | Deterministic sorting by stated city, school and interests; explanation displayed | Heuristic, not an internship/recruiting prediction |
| Opportunity saving | Persistent local stored state; source links and .ics export | Saving, calendar export and adding to Google Calendar **do not register** at an event |
| Professional contacts | Contacts, sourced biography URL, notes, relationship state, chronological interaction journal, edit/delete API | Student-entered claims remain marked student-attested; no identity verification or automated scraping |
| Speaker background search | Optional Wikipedia public candidate search (external request; scope required) | Candidates are **not** identity verified; use organizer/official biography before networking |
| Minto-style outreach | Purpose-first request, one supplied factual detail, explicit draft status; local drafts | Drafts do not imply facts are verified; no auto-email |
| Gmail drafts | Optional Google OAuth with `gmail.compose`; creates a real Gmail draft after in-app permission + explicit approval | Needs personal Google OAuth credentials + account consent; not tested with live personal account in this release |
| Gmail sending | From an existing Gmail draft, explicit user click, confirmation phrase, `email.send=ALLOW` | No background sends; external sends are irreversible; Google API may fail or be blocked by network |
| Google Calendar | Read upcoming entries, create a calendar event with permission + explicit approval | Creation isn't event registration; exact timezone needed for timed appointments |
| Study/career deadlines | Local tasks, categories, due dates, completion and deletion | No background reminders or live monitoring while app is closed |
| Local vault | AES-256-GCM encrypted Google refresh tokens in `.local` | The encryption key is on the same machine. This is not equivalent to an OS keychain, encrypted filesystem, or hardware-backed vault |

## Public event feeds

Amicus allows only HTTPS URLs with **exact allowlisted hostnames**, refuses credentials/custom ports/redirects, checks DNS for obvious private-IP results, applies a size cap and timeout, and parses iCalendar content without executing it.

Texas Law's source is approved by default: `https://law.utexas.edu/calendar/feed/ics/` (source directory `https://law.utexas.edu/calendar/feeds/`). Other verified public calendar sources are linked on the Career page, but only Texas Law is configured for one-click live sync. To approve a trusted school feed, add to `.env`:

```
AMICUS_EVENT_FEED_HOSTS=calendar.example.edu,law.example.edu
```

Then enter the actual approved HTTPS feed URL on the Career page. **Do not approve domains you do not trust.** For schools without a live feed, download an `.ics` file from their official site and import it through the page. Repeating import of the same file/source does not duplicate existing event IDs. RFC 5545 recurring-event expansion is not implemented; the adapter indexes emitted VEVENT instances. Registration is only through the actual event/organizer's website.

## Google OAuth on a single-user local machine

1. Create or use your own **Google Cloud project**, enable **Gmail API** and **Google Calendar API**, and configure its **OAuth consent screen**. A test-mode consent screen can be restricted to the intended student's Google account.
2. Create an **OAuth 2.0 Web application** client. Add authorized redirect URI `http://127.0.0.1:4173/api/google/callback` (change port if you changed `PORT`).
3. Copy `.env.example` to `.env`, and set `AMICUS_GOOGLE_CLIENT_ID` and `AMICUS_GOOGLE_CLIENT_SECRET`. Do not commit or share the file.
4. Restart Amicus. In **Career strategy → Google integrations**, use Connect Gmail and Connect Calendar separately, granting only the chosen scopes.
5. Under **Data & controls**, explicitly change `gmail.draft` or `calendar.read` / `calendar.write` to `ALLOW` as appropriate. `email.send` remains `ASK` and is blocked until you deliberately set it to `ALLOW`; every individual send also requires confirmation.
6. Create a local networking draft. Review it and verify the recipient and facts. Create the Gmail draft with the in-app approval. The browser will show it as `GMAIL DRAFT — not sent`. Sending is a separate action.

OAuth scopes: Gmail `https://www.googleapis.com/auth/gmail.compose`; Calendar `https://www.googleapis.com/auth/calendar.events`. These provide broader access than a one-off email; evaluate consent carefully. Google may require verification/allowlisting depending on your OAuth project settings. **The ChatGPT Gmail/Calendar connectors do not automatically connect to this standalone application.**

Google access tokens are refreshed server-side. Refresh tokens are stored AES-256-GCM encrypted in `.local/google-tokens.enc`, with a local key in `.local/google-vault.key`, neither committed nor included in `/api/export`. `Start Fresh` deletes both vault files as well as documents, contact records, task data and audit history. Back up `.local` before updates if you want to preserve state. To disconnect only one service, use the Career page; the application removes that service's local refresh token (it cannot guarantee remote OAuth revocation). Revoke access separately in your Google Account security settings when appropriate.

## Failure and uncertainty rules

- Network failure means no new live events, not made-up fallback opportunities.
- A discovered event is not an available ticket, RSVP, or registration.
- A saved event is not a calendar entry. A calendar entry is not registration.
- A speaker research hit is a **candidate**, not a verified identity. Human confirmation is required before claiming biography facts.
- A composed draft is not sent; a created Gmail draft is not sent.
- A public calendar entry is a source listing. Check official dates and availability immediately before making travel or attendance decisions.
- Career personalization ranks matches but is not an evidence-based prediction of employment or grade outcomes.
- No automated monitoring or background tasks are active when Amicus is closed.
- GDPR/FERPA/Google restricted-scope app verification, code signing and external penetration testing have **not** been completed; treat the application as a personal demo, not a commercial multiuser product.

## v0.5 acceptance tests

- Public `.ics` fixture parses event times, URLs and folded text; old entries are filtered, and export is valid iCalendar.
- Unauthorized feed hosts are refused; fetch follows no redirects.
- Student interests/city influence a transparent local relevance ranking, no invented external data.
- Contacts, interactions, tasks and draft updates persist in SQLite and can be deleted/reset.
- Wikipedia speaker research is explicitly marked as unverified and requires consent.
- Gmail draft and send and Google Calendar create are blocked unless each capability is `ALLOW` **and** an explicit per-action approval string is provided.
- OAuth state is random and checked; refresh-token storage is encrypted; draft MIME encoding is tested against header injection.
- UI render test verifies the new Career page is present and escapes untrusted contact names.
- Existing *Palsgraf*, retrieval, assessment, migration and privacy tests still pass.

`npm test` runs the full deterministic test suite without live credentials. **These tests do not replace real Google-account, network, or browser acceptance testing**. A real Chromium test was attempted in the development container, but browser navigation to local URLs was blocked by container administrator policy; Node DOM-render, server HTTP and unit tests passed.
