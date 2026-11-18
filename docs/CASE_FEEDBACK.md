# Palsgraf formative case-work feedback — v0.4.0

## What works

At each simulation stage, the student can save a legal work product and request a review. A configured OpenAI-compatible model receives **only** the work product, current stage, side, and facts already disclosed for counsel at that stage. It returns structured feedback: short strengths, questions/risks, a follow-up challenge and references to disclosed fact IDs.

Fact IDs returned by the model are checked against the known ledger and unknown IDs are removed. That is **not** a semantic test of whether the cited fact supports the claim. Model feedback is labelled uncalibrated and **never updates an academic mastery percentage automatically**. It is preserved as formative practice evidence linked to the submitted work ID.

If no model is configured, its response fails the structured format or it tries to reveal the sealed outcome, Amicus supplies a clearly labelled guided checklist for that stage instead. Requests for the same unchanged work return the prior review without duplicating the learning-evidence record. A new submitted work product can receive a new review.

## Non-leakage and interlocutor isolation

- The model's review prompt does not include the eventual majority/dissent before the historical reveal.
- Case conversation history is sent only to the **same interlocutor in the same stage**. Private client interviews must not become part of the simulated opposing counsel's context. Legacy turns without role/stage metadata are not provided to agents.
- Uploaded student notes and textbooks are **never** part of the case character prompt.
- A user-supplied work product mentioning the future outcome is not sent to the reviewer before the reveal.
- These are bounded prompt/context and conservative string checks, not proof that a pretrained generative model can never disclose information it already learned.

## Validation and known limitations

The automated tests exercise valid model feedback, missing/unknown evidence IDs, refusal to conflate AI feedback with a grade, offline checklist, duplicate work review, private conversation isolation between roles, and complete Start Fresh audit deletion. Human likeness, legal claim truth, fairness across writing styles, historical procedure and live-provider behaviour still require independent validation.

**Future hardening:** independent second-pass evidence verifier; response claim support validation; identity/prompt-injection red-team evaluations; evaluation dataset from licensed court transcripts; jurisdiction- and date-sensitive historical authority routing; realistic objections and witness examination; optional local voice input/output. No fine-tuning has been performed.
