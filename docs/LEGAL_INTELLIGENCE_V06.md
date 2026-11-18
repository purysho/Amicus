# Amicus v0.6: sourced legal intelligence, not an automatic legal oracle

**Release stage:** Evidence-first demonstration. This is not a validated citator, legal opinion system, judicial transcript reconstruction, or calibrated cognitive diagnostic instrument.

## 1. Authentic *Palsgraf* record

Official research guide: https://askalawlibrarian.nycourts.gov/legalresearch/faq/433991

University-hosted 44-page case-on-appeal scan: https://www.law.berkeley.edu/files/Palsgraf_Record.pdf

The 1928 appeal record includes actual, printed trial testimony from May 1927, statements under court procedure and the original allegations. In `data/primary-record.json`, six **manually page-checked summaries** are recorded with PDF page locators and explicit classes:

- `PROCEDURAL_RECORD`: an event in the documented proceeding, not a factual verdict on the underlying accident.
- `PLEADING_ALLEGATION`: a party's allegations, not established truth.
- `SWORN_TESTIMONY`: an attributed witness account, not necessarily an independently corroborated fact.

The original scan is **not included in the repository**. This avoids redistributing an archived scan whose hosting and reproduction terms have not been independently cleared. Students may download the record from the official guide's linked host, then import that PDF into their own local Amicus installation.

### Local PDF import

Choose Case Simulation → **Import the complete scanned record**, and select the 44-page PDF. Amicus requires local Poppler (`pdfinfo`, `pdftotext`, `pdftoppm`) and, for image-only pages, Tesseract with English language files. It computes a SHA-256 hash, extracts text at page granularity and stores it locally in SQLite.

**IMPORTANT:** User-uploaded PDFs are **not authenticated** against a published master checksum. OCR may contain errors. The UI labels them `USER-UPLOAD-NOT-AUTHENTICATED` and `OCR not verified`; an exact string hit is not proof that the original scan says the same thing. Visual verification is required before relying on a quote. Only manually reviewed pages can be searched before historical reveal; all other uploaded pages remain sealed until stage 6.

OCR of a 44-page scanned record is compute-intensive. The app performs it locally and may block the single-user server while the import completes. It does not send PDF contents to a cloud OCR service.

## 2. Citation adversarial checks

The Research vault contains a **claim & citation challenge**. It returns separate verdicts:

1. **Citation identity:** can the reporter/volume/page resolve to a known bibliographic record? For CourtListener users, the official authenticated citation lookup API can perform an independent network lookup.
2. **Historical date/veil:** did this authority exist at the simulated point in time? The 1928 *Palsgraf* result is blocked before the post-argument reveal.
3. **Quote matching:** does a purported exact quotation occur in accessible, OCR-extracted local material? If not, flag; if yes, retain an explicit `unverified-ocr` label.
4. **Substantive support:** **always unresolved** in the current implementation; a citation existing does not establish a proposition, controlling authority, subsequent history, or good-law treatment.

API: `POST /api/legal/verify` with `claim`, `citation`, optional `quote`, optional `external` boolean. External calls require an expressly configured `COURTLISTENER_API_TOKEN` **and** the `legal.external=allow` permission. The external request contains the citation string only—never the student's claim, notes or upload.

CourtListener API documentation: https://wiki.free.law/c/courtlistener/help/api/rest/v4/citation-lookup

Do **not** describe these checks as Shepard's, KeyCite, verified quotations, authoritative legal advice or complete adversarial legal research. They are safety-oriented building blocks. Production-grade support verification needs authoritative source text, independent annotators, treatment/history checks and calibrated claims benchmarks.

## 3. Digital Twin evidence discipline

Amicus distinguishes **synthetic demo priors** from actual student evidence. `competencyReport` computes objective attempts from unique keyed questions and separate text exercises. A numerical performance indication is withheld until at least four independently keyed objective questions across three contexts exist. These thresholds are an **engineering safeguard, not validated psychometrics**.

Three new transfer exercises record written work, student self-confidence, and evaluation rubrics. They remain **ungraded** until independently scored. Repeat submissions do not produce duplicate evidence. Every mastery display should state its inputs; no feature may infer a law-school letter grade from these prototypes.

### Next calibration requirements

- A law-faculty-reviewed benchmark across multiple topics and schools.
- Blinded graders for legal writing, double scoring and inter-rater agreement.
- Isomorphic vs novel-transfer performance comparison.
- Per-skill calibration intervals, drift checks, and item-exposure controls.

## 4. Courtroom realism and evaluation

`evals/realism-fixtures.json` contains twelve targeted scenarios: hidden disposition, unsupported names, client knowledge, witness uncertainty, judicial interruption, limiting principles and cross-examination. `npm run eval:realism` executes the current simulation engine against these fixtures and reports deterministic guardrail findings.

The included `evals/guided-baseline.json` is the **offline guided baseline**, not an AI realism score: 12 / 12 surface guardrails passed on this frozen evaluation. Human conversational naturalness, legal correctness, and historical fidelity were **not independently measured**. With a configured model, `node scripts/eval-realism.mjs --allow-model` runs model-facing tests, but external model calls require the operator's explicit consent; evaluate anonymized fixture data only.

Use the five-dimension human annotation rubric in `server/realism.mjs`: source fidelity, role fidelity, responsiveness, conversational naturalness, and procedural fidelity. In-app ratings are **self-rated** and cannot be confused with blinded independent scores.

A real courtroom transcript is a **behavioral reference**, not a proof of correctness or license to impersonate historical people. Public US Supreme Court transcript archives are available at https://www.supremecourt.gov/oral_arguments/availabilityoforalargumenttranscripts.aspx . No transcript-based model training or fine-tuning has been performed. Transcript redistribution/training permissions must be reviewed source by source.

## 5. Release evidence

- `npm test` — deterministic and HTTP regression suite.
- `npm run eval:realism` — explicit surface-level benchmark.
- Browser walkthrough — not verified in this environment; browser localhost networking was blocked by administrative policy.
- External CourtListener lookup — only tested with a mock response, **not with live credentials**.
- Scanned PDF OCR — code path present; authentic 44-page original was visually inspected through the archived PDF viewer, but automatic local import of that original requires downloading it on the end user's computer.

Failure-closed behavior should be the default. Real-world deployment still requires penetration testing, accessibility review, independent legal expertise and a human-scored agent realism benchmark.
