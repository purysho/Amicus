# Local academic document retrieval — v0.3.0

**Scope and claim:** Amicus now supports local *lexical passage retrieval*, not vector search, learned ranking, verified case citation, or a production legal citator. It uses SQLite FTS5 and no external search/embedding API.

## Pipeline

1. The user imports a `.txt`, `.md` or selectable-text PDF (Poppler `pdftotext` required for PDF). The raw extracted text is stored locally, without silent truncation.
2. `server/retrieval.mjs` divides each extracted document into passage-sized chunks, preserving form-feed PDF page boundaries. The chunk number is stable for the stored version of the document.
3. `server/db.mjs` stores those passages in the SQLite FTS5 virtual table `document_passages`; an upgrade from 0.2.x automatically indexes existing uploaded documents at startup.
4. `POST /api/research/search` performs escaped lexical retrieval over local uploads and returns passage locator, exact excerpt and document identifier. No external provider is called.
5. The tutor queries the same store and supplies only retrieved passages in its context, with explicit `[D1]` locators. The AI is told that retrieved passages are untrusted document data, not instructions.
6. The offline tutor displays retrieved excerpts and a guided study prompt; without an LLM it does not pretend to synthesize or independently verify the law.

## Guarantees and gaps

- Search and tutoring honor the `documents.read` permission; `ask` and `deny` mean no access.
- While the Palsgraf historical outcome is sealed, imported documents identifiable by case-specific terms such as `Palsgraf`, `Cardozo`, `Andrews`, and the case citation are conservatively excluded from **search and tutor retrieval**. They remain available for the student to read manually. This is a coarse textual safeguard, **not** proof of non-leakage (a passage may convey the result without naming it).
- Case simulation characters *never* receive uploaded student documents as part of their prompts.
- A citation such as `[D1] torts-outline.txt · passage 2` locates an excerpt, not an independently verified authority; it does not establish current law or proper Bluebook format.
- Retrieval is lexical OR-based FTS5, so common terms or unusual punctuation may produce irrelevant results or miss semantic matches. No semantic retrieval score or claim-level verifier is claimed.
- Uploaded material is private to the local SQLite database unless the user explicitly enables remote-model transmission, in which case **retrieved passages may be sent** to that model provider. Remote-model permission is checked before the call.
- The 10 MB input cap remains; PDFs larger than that should be split. PDFs must have selectable text; OCR is not yet present.
- Academic integrity rules and licensing remain the user's responsibility; Amicus does not publish uploaded texts.

## Validation

`npm test` covers local document import and retrieval, user permission denial, source-locator consistency, casebook quarantine, mock model non-leak, and restart/upgrade behavior. Browser navigation remains separately covered by the frontend harness. Tests do not establish legal correctness, AI realism or production security certification.
