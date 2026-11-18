# Legal source register and rights policy

## Palsgraf anchors

1. **New York Unified Court System, Ask a Law Librarian (updated May 14, 2026)** — official research guide enumerating reported 1927/1928 proceedings and linking the surviving record & briefs: https://askalawlibrarian.nycourts.gov/legalresearch/faq/433991
2. **Court of Appeals: 248 N.Y. 339 (May 29, 1928)** — reported majority (Cardozo) and dissent (Andrews); case text at https://law.justia.com/cases/new-york/court-of-appeals/1928/248-n-y-339-1928.html
3. **Appellate Division: 222 A.D. 166 (1927)** — intermediate proceeding: https://www.neochart.com/catalog/cases/ad/volume_222/0166_01/index.html
4. **University of Minnesota Law Library** — researched secondary explanation, held behind the reveal: https://lawlibrarycollections.umn.edu/classic-cases-tort-palsgraf-v-long-island-railroad-co
5. **Berkeley-hosted record/briefs PDF** — linked by the New York court librarian: https://www.law.berkeley.edu/files/Palsgraf_Record.pdf

Case-fact summaries in `data/palsgraf.json` are paraphrased, source-linked and deliberately conservative. **The historical trial record is linked, not fully transcribed or exhaustively verified within this release.** Published-record fact and historic access date are distinct: later opinions are not usable as pre-1928 research authorities during simulated advocacy. The initial incident date (August 24, 1924) is explicitly documented by the 1927 appellate opinion.

## Real court transcripts and human-feeling AI

Authentic oral argument transcripts can teach **interaction structure**: judicial interruption, narrowing hypotheticals, concessions, repeated questioning, counsel's response latency and the discipline of admitting uncertainty. Strong sources include:

- Supreme Court's own oral argument transcript index and availability details: https://www.supremecourt.gov/oral_arguments/availabilityoforalargumenttranscripts.aspx
- Oyez archive: https://www.oyez.org/about
- Free Law Project's oral argument archive: https://free.law/projects/oral-arguments/

Important distinctions:

- *Palsgraf* was heard in the **New York Court of Appeals**, **not the US Supreme Court**. Oyez US Supreme Court audio does **not** provide an authentic Palsgraf argument.
- We have **not** verified an actual audio recording or verbatim 1928 appellate oral argument transcript for *Palsgraf*. A modern generated judge, witness, railroad employee or opposing lawyer is clearly **SIMULATED**; we never present its words as historical testimony.
- Availability online does not automatically confer permission for **model training**. Before fine-tuning, check the particular transcript's rights/terms, provenance, licensing and any publicity/voice rules. This demo uses **behavioral prompting** (original instructions), not training/fine-tuning on third-party transcripts.
- Never copy a real person's voice for character performance without an appropriate rights/consent review. Text-only is the default; future TTS can use generic licensed voices.

## Future authority adapters

- CourtListener REST v4: https://wiki.free.law/c/courtlistener/help/api/rest/v4/case-law — use only authorized credentials; check current terms and rate limits.
- CourtListener MCP: https://github.com/freelawproject/courtlistener-api-client/blob/main/MCP_README.md
- Congress.gov / GovInfo: official legislation, public law, regulations and federal publications; build type-specific provenance and effective-date semantics.

No licensing status is inferred merely from a source's accessibility. Source acquisition, extraction, semantic verification, negative-treatment checks and redistribution rights must be individually tracked before expanding the corpus.
