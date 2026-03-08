You are a focused subagent reviewer for a single holistic investigation batch.

Repository root: /Users/charlesdunda/src/s33dunda/RogueNode-desloppify
Blind packet: /Users/charlesdunda/src/s33dunda/RogueNode-desloppify/.desloppify/review_packet_blind.json
Batch index: 16
Batch name: design_coherence
Batch rationale: seed files for design_coherence review

DIMENSION TO EVALUATE:

## design_coherence
Are structural design decisions sound — functions focused, abstractions earned, patterns consistent?
Look for:
- Functions doing too many things — multiple distinct responsibilities in one body
- Parameter lists that should be config/context objects — many related params passed together
- Files accumulating issues across many dimensions — likely mixing unrelated concerns
- Deep nesting that could be flattened with early returns or extraction
- Repeated structural patterns that should be data-driven
Skip:
- Functions that are long but have a single coherent responsibility
- Parameter lists where grouping would obscure meaning
- Files that are large because their domain is genuinely complex, not because they mix concerns
- Nesting that is inherent to the problem (e.g., recursive tree processing)

YOUR TASK: Read the code for this batch's dimension. Judge how well the codebase serves a developer from that perspective. The dimension rubric above defines what good looks like. Cite specific observations that explain your judgment.

Mechanical scan evidence — navigation aid, not scoring evidence:
The blind packet contains `holistic_context.scan_evidence` with aggregated signals from all mechanical detectors — including complexity hotspots, error hotspots, signal density index, boundary violations, and systemic patterns. Use these as starting points for where to look beyond the seed files.

Seed files (start here):
- convex/gameActions.ts
- components/GameTerminal.tsx
- convex/schema.ts
- convex/missions.ts
- convex/agents/pingAgent.ts
- convex/cacheCleanup.ts
- convex/utils/cacheUtils.ts
- components/TerminalOutput.tsx
- components/TerminalInput.tsx
- components/CRTEffects.tsx
- app/layout.tsx
- app/page.tsx
- components/ConvexClientProvider.tsx
- convex/lib/auth.ts
- lib/hooks/useCommandProcessor.ts
- convex/types.ts

Mechanical concern signals — navigation aid, not scoring evidence:
Confirm or refute each with your own code reading. Report only confirmed defects.
  - [design_concern] app/layout.tsx
    summary: Design signals from orphaned
    question: Is this file truly dead, or is it used via a non-import mechanism (dynamic import, CLI entry point, plugin)?
    evidence: Flagged by: orphaned
    evidence: [orphaned] Orphaned file (41 LOC): zero importers, not an entry point
  - [design_concern] app/page.tsx
    summary: Design signals from orphaned
    question: Is this file truly dead, or is it used via a non-import mechanism (dynamic import, CLI entry point, plugin)?
    evidence: Flagged by: orphaned
    evidence: [orphaned] Orphaned file (66 LOC): zero importers, not an entry point
  - [design_concern] components/CRTEffects.tsx
    summary: Design signals from single_use
    question: Review the flagged patterns — are they design problems that need addressing, or acceptable given the file's role?
    evidence: Flagged by: single_use
    evidence: [single_use] Single-use (27 LOC): only imported by components/GameTerminal.tsx
  - [design_concern] components/ConvexClientProvider.tsx
    summary: Design signals from single_use
    question: Review the flagged patterns — are they design problems that need addressing, or acceptable given the file's role?
    evidence: Flagged by: single_use
    evidence: [single_use] Single-use (20 LOC): only imported by app/layout.tsx
  - [design_concern] components/GameTerminal.tsx
    summary: Design signals from single_use, smells
    question: Review the flagged patterns — are they design problems that need addressing, or acceptable given the file's role?
    evidence: Flagged by: single_use, smells
    evidence: [single_use] Single-use (203 LOC): only imported by app/page.tsx
  - [design_concern] components/TerminalInput.tsx
    summary: Design signals from single_use
    question: Review the flagged patterns — are they design problems that need addressing, or acceptable given the file's role?
    evidence: Flagged by: single_use
    evidence: [single_use] Single-use (33 LOC): only imported by components/GameTerminal.tsx
  - [design_concern] components/TerminalOutput.tsx
    summary: Design signals from single_use
    question: Review the flagged patterns — are they design problems that need addressing, or acceptable given the file's role?
    evidence: Flagged by: single_use
    evidence: [single_use] Single-use (37 LOC): only imported by components/GameTerminal.tsx
  - [design_concern] convex/agents/pingAgent.ts
    summary: Design signals from orphaned, smells
    question: Is this file truly dead, or is it used via a non-import mechanism (dynamic import, CLI entry point, plugin)?
    evidence: Flagged by: orphaned, smells
    evidence: [orphaned] Orphaned file (192 LOC): zero importers, not an entry point
  - (+4 more concern signals)

Task requirements:
1. Read the blind packet's `system_prompt` — it contains scoring rules and calibration.
2. Start from the seed files, then freely explore the repository to build your understanding.
3. Keep issues and scoring scoped to this batch's dimension.
4. Respect scope controls: do not include files/directories marked by `exclude`, `suppress`, or non-production zone overrides.
5. Return 0-10 issues for this batch (empty array allowed).
6. For design_coherence, use evidence from `holistic_context.scan_evidence.signal_density` — files where multiple mechanical detectors fired. Investigate what design change would address multiple signals simultaneously. Check `scan_evidence.complexity_hotspots` for files with high responsibility cluster counts.
7. Workflow integrity checks: when reviewing orchestration/queue/review flows,
8. xplicitly look for loop-prone patterns and blind spots:
9. - repeated stale/reopen churn without clear exit criteria or gating,
10. - packet/batch data being generated but dropped before prompt execution,
11. - ranking/triage logic that can starve target-improving work,
12. - reruns happening before existing open review work is drained.
13. If found, propose concrete guardrails and where to implement them.
14. Do not edit repository files.
15. Return ONLY valid JSON, no markdown fences.

Scope enums:
- impact_scope: "local" | "module" | "subsystem" | "codebase"
- fix_scope: "single_edit" | "multi_file_refactor" | "architectural_change"

Output schema:
{
  "batch": "design_coherence",
  "batch_index": 16,
  "assessments": {"<dimension>": <0-100 with one decimal place>},
  "dimension_notes": {
    "<dimension>": {
      "evidence": ["specific code observations"],
      "impact_scope": "local|module|subsystem|codebase",
      "fix_scope": "single_edit|multi_file_refactor|architectural_change",
      "confidence": "high|medium|low",
      "issues_preventing_higher_score": "required when score >85.0",
      "sub_axes": {"abstraction_leverage": 0-100, "indirection_cost": 0-100, "interface_honesty": 0-100, "delegation_density": 0-100, "definition_directness": 0-100, "type_discipline": 0-100}  // required for abstraction_fitness when evidence supports it; all one decimal place
    }
  },
  "issues": [{
    "dimension": "<dimension>",
    "identifier": "short_id",
    "summary": "one-line defect summary",
    "related_files": ["relative/path.py"],
    "evidence": ["specific code observation"],
    "suggestion": "concrete fix recommendation",
    "confidence": "high|medium|low",
    "impact_scope": "local|module|subsystem|codebase",
    "fix_scope": "single_edit|multi_file_refactor|architectural_change",
    "root_cause_cluster": "optional_cluster_name_when_supported_by_history"
  }],
  "retrospective": {
    "root_causes": ["optional: concise root-cause hypotheses"],
    "likely_symptoms": ["optional: identifiers that look symptom-level"],
    "possible_false_positives": ["optional: prior concept keys likely mis-scoped"]
  }
}
