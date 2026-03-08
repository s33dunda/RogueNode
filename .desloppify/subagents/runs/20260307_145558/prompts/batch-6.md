You are a focused subagent reviewer for a single holistic investigation batch.

Repository root: /Users/charlesdunda/src/s33dunda/RogueNode-desloppify
Blind packet: /Users/charlesdunda/src/s33dunda/RogueNode-desloppify/.desloppify/review_packet_blind.json
Batch index: 6
Batch name: abstraction_fitness
Batch rationale: seed files for abstraction_fitness review

DIMENSION TO EVALUATE:

## abstraction_fitness
TypeScript abstraction fitness: type and interface layers should improve safety and design clarity, not add ceremony or pass-through indirection.
Look for:
- Functions/components that only forward props or args without behavior, validation, or translation
- Interfaces/types with one implementation and no polymorphic usage pressure
- Large option objects passed through multiple layers with only a small subset used locally
- Generic helper abstractions with one concrete type usage in practice
- Cross-feature chains of wrappers that pass data unchanged between controller/service/helper layers
- Widespread one-implementation interface ecosystems that add naming ceremony without substitution value
Skip:
- React/Next.js framework composition patterns required by routing or lifecycle boundaries
- Wrappers that intentionally add auth, telemetry, caching, feature flags, or retries
- Public API typing shells that isolate external SDK volatility
- Intentional barrel/facade exports that define stable package entry points

YOUR TASK: Read the code for this batch's dimension. Judge how well the codebase serves a developer from that perspective. The dimension rubric above defines what good looks like. Cite specific observations that explain your judgment.

Mechanical scan evidence — navigation aid, not scoring evidence:
The blind packet contains `holistic_context.scan_evidence` with aggregated signals from all mechanical detectors — including complexity hotspots, error hotspots, signal density index, boundary violations, and systemic patterns. Use these as starting points for where to look beyond the seed files.

Seed files (start here):
- convex/gameActions.ts
- convex/agents/pingAgent.ts
- convex/missions.ts
- convex/cacheCleanup.ts
- convex/gameData.ts
- components/GameTerminal.tsx
- convex/utils/cacheUtils.ts
- convex/lib/auth.ts

Task requirements:
1. Read the blind packet's `system_prompt` — it contains scoring rules and calibration.
2. Start from the seed files, then freely explore the repository to build your understanding.
3. Keep issues and scoring scoped to this batch's dimension.
4. Respect scope controls: do not include files/directories marked by `exclude`, `suppress`, or non-production zone overrides.
5. Return 0-10 issues for this batch (empty array allowed).
6. For abstraction_fitness, use evidence from `holistic_context.abstractions`:
7. - `delegation_heavy_classes`: classes where most methods forward to an inner object — entries include class_name, delegate_target, sample_methods, and line number.
8. - `facade_modules`: re-export-only modules with high re_export_ratio — entries include samples (re-exported names) and loc.
9. - `typed_dict_violations`: TypedDict fields accessed via .get()/.setdefault()/.pop() — entries include typed_dict_name, violation_type, field, and line number.
10. - `complexity_hotspots`: files where mechanical analysis found extreme parameter counts, deep nesting, or disconnected responsibility clusters.
11. Include `delegation_density`, `definition_directness`, and `type_discipline` alongside existing sub-axes in dimension_notes when evidence supports it.
12. Do not edit repository files.
13. Return ONLY valid JSON, no markdown fences.

Scope enums:
- impact_scope: "local" | "module" | "subsystem" | "codebase"
- fix_scope: "single_edit" | "multi_file_refactor" | "architectural_change"

Output schema:
{
  "batch": "abstraction_fitness",
  "batch_index": 6,
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
