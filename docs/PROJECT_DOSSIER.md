# Amicus — Build-Ready Project Dossier (Frozen v0.1)

## Product thesis
A US law student's personal operating system from 1L through 3L: an auditable AI chief-of-staff joining academic mastery, legal-work simulation, verified research, workload allocation, career strategy, communications, and a longitudinal Personal Legal Brain.

## Frozen product decisions
- US law students, 1L–3L; real single user, unknown profile at first launch.
- Adaptive optimization across academics, lawyer skills, career, and workload.
- Graduated autonomy per capability; consequential external actions can require approval.
- Academic Digital Twin: evidence-backed, uncertainty-aware, adversarially tested.
- Student-controlled teaching modes: Explain, Teach, Socratic, Cold Call, Hint, Exam, Model Answer.
- Full legal simulation world long-term; one historical Palsgraf vertical slice today.
- Historical and Practice modes. Historical facts immutable; inferred/simulated content labelled.
- Adaptive adversarial representation and eventual role reversal.
- AI-native command center; professional intelligence workspaces underneath.
- End-to-end golden path across study, simulation, career, communications and permissions.
- Demo Student + Start Fresh architecture.
- Hybrid local-first; provider-independent model routing; future maximum-local/offline mode is a requirement.
- Claim-level legal evidence graph plus adversarial verification.
- Career Strategy Agent maintains opportunity gaps and relationship strategy.
- Whole-student workload orchestration.
- Academic knowledge graph preserves source class and detects contradictions.
- Evidence-backed legal writing with skill-preservation controls.
- Active school intelligence when authorized.
- User-governed zero-trust data/agent control center.
- Decision engine, not grade oracle.
- Controlled collaboration boundary; export only in demo.
- Auditable chief-of-staff recommendations.
- Evidence-first vertical slice over decorative breadth.
- Live integrations where available; explicit demo adapters otherwise; future fully self-contained mode.
- Acceptance hierarchy: utility > technical defensibility > demo impact > extensibility.
- Modern AI surface + dense professional intelligence workspaces.
- Evidence-based professional progression, not game-like XP.
- Bounded-knowledge simulation agents and historical-time research constraints.
- Multimodal advocacy architecture; text is complete fallback.
- Longitudinal Personal Legal Brain + metacognitive model.
- Lifelong Legal OS extension points; post-law-school features excluded today.
- Full epistemic repair with downstream dependency re-evaluation and preserved audit history.

## Core architecture
UI shell -> Chief-of-Staff Orchestrator -> scoped specialist agents -> policy/permission gateway -> evidence services / Personal Legal Brain / Digital Twin / simulation state -> adapters (models, legal data, email, calendar, events, school sources).

No agent receives the entire user state by default. Capabilities request minimum scopes. Simulation agents additionally receive a knowledge envelope specifying which facts, dates, work products, and authorities they may access.

## Data primitives
### EvidenceClaim
id; proposition; source_id; source_class; jurisdiction; court; effective_date; passage_locator; support_type; verification_state; confidence; treatment; retrieved_at; historical_availability_date.

### StudentEvidence
id; competency_id; artifact_id; context_type; observed_behavior; score/rubric; evaluator; uncertainty; timestamp; independence_group.

### CompetencyState
competency_id; estimate; confidence; evidence_ids[]; last_transfer_test; decay_policy; recurring_misconceptions[]; next_best_test.

### KnowledgeNode
course; doctrine; case; authority; professor_emphasis; student_note; generated_explanation; contradiction_edges[].

### SimulationFact
fact_id; text; status=HISTORICAL|INFERRED|SIMULATED; source_ids[]; exists_from; known_by[]; discovered_by_student_at; contradiction_ids[].

### Relationship/Opportunity
person/org/event; verified_public_facts; interaction_history; career_goal_edges; next_action; permission_state.

## Palsgraf vertical slice
Historical journey: client -> investigation -> theory -> trial -> appeal -> historical reveal -> role-reversal extension.

Hard constraint: post-cutoff authorities and the eventual 1928 Court of Appeals reasoning cannot enter pre-decision agent context. Historical Mode cannot invent helpful evidence. Practice Mode may branch but must label counterfactual material.

Authoritative anchor: Palsgraf v. Long Island R.R. Co., 248 N.Y. 339 (1928), argued Feb. 24, 1928 and decided May 29, 1928. New York Courts research guidance identifies the related appellate records/briefs and repositories.

## Legal research adapters
Primary production target: official court/government sources plus CourtListener REST/MCP. Federal legislation can use Congress.gov API and GovInfo. Commercial databases remain external unless licensing explicitly permits integration.

Verification pipeline: retrieve -> normalize -> proposition extraction -> source/jurisdiction/date validation -> treatment check where available -> adversarial support test -> claim graph -> generation. Failure produces uncertainty, not a confident assertion.

## Digital Twin evaluation
Mastery is not a quiz percentage. Independent evidence groups prevent repeated variants of one question from inflating confidence. Transfer tests change surface form/context. Adversarial probes attempt to falsify mastery. Outputs include estimate, confidence, supporting/contradictory evidence, misconception history, and next-best assessment.

## Epistemic repair
A correction creates a new versioned claim, never silently overwrites history. Dependency graph identifies affected notes, generated work, assessments, simulations and competency evidence. Re-evaluation jobs recalculate downstream state and display the delta to the student.

## Security/privacy
Local-first student vault; scoped agent context; capability-based actions; explicit external-provider disclosure; action audit; export/correction/deletion controls. Future local model adapters must satisfy the same model interface. Prompt-injected documents are untrusted data, never instructions.

## Today's acceptance suite
1. Home recommendation cites measurable student evidence.
2. Novel Torts assessment changes mastery but does not claim certainty from one test.
3. Palsgraf starts with historical outcome sealed.
4. Case agents cannot use sealed Cardozo/Andrews reasoning before reveal.
5. Case performance propagates to Digital Twin.
6. Research screen distinguishes verified authority from system policy/simulation data.
7. Career recommendation is connected to an identified skill/career gap.
8. Email workflow produces draft only when send permission requires approval.
9. Audit screen records consequential actions.
10. App runs locally without network access; external adapters have fallback boundaries.

## Next production phases
P1: robust ingestion/RAG + SQLite graph/state + real model router + evaluation harness.
P2: full Palsgraf corpus ingestion, temporal authority filtering, bounded multi-agent simulation, work-product grading.
P3: Gmail/Calendar + live event/speaker research + relationship graph + school intelligence adapters.
P4: voice advocacy, role reversal, additional historical/fictional matters, offline/local-model pack.
P5: bar/transition-to-practice extension points only after law-school product is validated.
