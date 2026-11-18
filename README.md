# Amicus — a personal Law Student OS

**Status:** v0.4.0 evidence-first vertical slice; an experimental local prototype, not a legal research service or a production legal assistant.

Amicus is a US 1L–3L personal operating system that connects study, evidence-backed progress, a historically grounded *Palsgraf* simulation, professional communications, and privacy controls. It is built for **one real student**, with an optional synthetic demo profile.

**v0.3.0 foundation:** Local full-text passage search for uploaded documents, passage/page citations to retrieved excerpts, retrieval-grounded tutoring, backward indexing of existing `.local/amicus.db` uploads, and conservative quarantine of Palsgraf-related documents while the historical outcome is sealed. The 0.2.1 Case Simulation fix remains included. **No legal claim-level verification or fine-tuning has been performed.**

**v0.4.0 upgrade:** Case-work formative review after saving a stage work product (AI-generated structured feedback when configured; otherwise an honest offline checklist); evidence references verified against disclosed fact IDs; case review evidence stored separately from mastery grades; no duplicate credit for re-reviewing unchanged work; role-and-stage isolated conversational memory; `Start Fresh` now wipes the audit log as well as uploaded files and student state.

## Run locally (Windows, macOS or Linux)

Requires **Node.js 22.13+** (Node 24 recommended). There are **no npm dependencies**.

```powershell
# From the repository folder
npm start
```

Open **http://127.0.0.1:4173**. Data goes to `.local/amicus.db` on your machine. The local server binds only to `127.0.0.1`, not the public network. SQLite in Node 22 is experimental; Node 24 is preferred for long-term use.

### Real conversational AI (optional)

Without a model, simulations and tutoring show **guided offline responses** that are explicitly labelled. They are not passed off as generative conversation. To enable genuinely adaptive dialogue:

1. Copy `.env.example` to `.env`.
2. Set a provider's **OpenAI-compatible** `/v1` URL and a valid model ID. For a hosted API, set `AMICUS_MODEL_API_KEY`.
3. Restart the server.
4. For a **remote** provider, open **Data & controls** and set `model.remote` to `ALLOW` before sending content externally. For a local provider (e.g. Ollama on `http://127.0.0.1:11434/v1`), no remote permission is required.

Example for a local Ollama server running a model you already installed:

```
AMICUS_MODEL_BASE_URL=http://127.0.0.1:11434/v1
AMICUS_MODEL=your-local-model-id
```

**Do not paste API keys into the browser UI or commit `.env`.** Local runtime config and the SQLite database are ignored by Git.

## First route through the demo

1. From **Overview**, take a novel duty/scope transfer assessment (deterministic scoring with auditable history; repeated exact items don't count twice).
2. Open **Palsgraf**; choose a side, interview simulated characters, inspect evidence with provenance and record a real work product at each stage before advancing.
3. Traverse the **historical veil**: facts unlock by stage; final reported opinions unlock only after the appellate argument.
4. After saving a case-work product, click **Show review checklist** (offline) or **Request AI feedback** (model configured); inspect which disclosed fact IDs the reviewer used. Compare competing legal approaches, perform role reversal, and export personal data if desired.
5. Upload a `.txt` or `.md` course excerpt (PDF extraction works when **Poppler `pdftotext`** is installed); search the text from **Research vault** and ask the tutor a related question to see retrieved passage references. Draft a networking email and inspect permissions and the audit history.

## Implemented versus not implemented

| Feature | This release |
|---|---|
| Local-first personal workspace, demo vs fresh | Working |
| SQLite persistence, permissions, audit, export | Working |
| Digital Twin evidence log & repeat-resistant multiple-choice assessments | Working prototype; heuristic/synthetic prior, **not calibrated** |
| Text/Markdown import, text-PDF extraction and local passage search | Working; PDF requires Poppler; scanned PDFs need later OCR |
| Role-specific model conversations | Model adapter works **when provider configured**; otherwise labelled guided fallback; naturalness not validated |
| Historical evidence unlock, stage progression and role-scoped conversation memory | Working simplified workflow; model leaks are not formally impossible |
| Work-product review and cross-module formative learning evidence | Working guided offline checklist / structured AI feedback when configured; **no calibrated grading** |
| Historical source linking and post-1928 reveal | Working; links verified; **full trial record not ingested** |
| Networking email draft | Working template; **never sends** |
| Events and legal research | Verified source directories only; no live search/booking/citator yet |
| Automated adversarial citation verification, semantic grading | **Not implemented** |
| Semantic/vector RAG, voice, fine-tuning on transcripts, Gmail/Calendar, OCR | **Not implemented** |

## Read before extending

- [`docs/PROJECT_DOSSIER.md`](docs/PROJECT_DOSSIER.md) — frozen interview requirements.
- [`docs/SOURCES_AND_RIGHTS.md`](docs/SOURCES_AND_RIGHTS.md) — historical record, real transcripts, attribution and licensing.
- [`docs/AI_BEHAVIOR.md`](docs/AI_BEHAVIOR.md) — character constraints, safety and evaluations.
- [`docs/LOCAL_RETRIEVAL.md`](docs/LOCAL_RETRIEVAL.md) — indexed text search, citations, permission boundaries, and limitations.
- [`docs/CASE_FEEDBACK.md`](docs/CASE_FEEDBACK.md) — model feedback limits, case-work evidence, and character conversation isolation.
- [`tests/`](tests/) — executable baseline tests.

## Testing

```bash
npm test
```

This app is for **educational simulation**, not legal advice. AI-generated dialogue is not historical testimony. The real student should never treat practice scores as an accurate grade forecast without rigorous calibration. Any live model can hallucinate despite prompt constraints; recheck primary sources before relying on legal assertions.

## Upgrading an existing local installation

Stop the server with Ctrl+C. Replace the application files with the new release **without deleting `.local/amicus.db`**. Re-run `npm start`; Amicus automatically indexes previously uploaded documents. Back up `.local/amicus.db` (including its `-wal`/`-shm` sidecars when present) before substantial updates. The app must be stopped to copy the database consistently.

This release's browser UI has a local research search box. GitHub may not be reachable from some Windows networks; the release ZIP works independently after extraction.
