#!/usr/bin/env python3
"""
Minimal POC runner: domain + problem -> plan using Unified Planning + Fast Downward.

Usage:
  python scripts/plan_fd.py --domain rogue-devops-poc-domain.pddl --problem poc-reachability.pddl

Optional:
  --json                        Output JSON instead of text
  --out PATH                    Write JSON result to PATH
  --validate                    Validate the returned plan against the given problem
  --fd-search-config CONFIG     Fast Downward search config string (e.g., 'let(hff,ff(),eager_greedy([hff],preferred=[hff]))')
  --fd-translate-options OPTS   Additional translate.py options (repeatable), e.g., --fd-translate-options --full-encoding --fd-translate-options --relaxed

Install prerequisites (manual step):
  pip install "unified-planning[fast-downward]"

Note:
  This script does not install dependencies; it assumes the above is available in your environment.
"""
from __future__ import annotations
import sys
import json
import argparse
from typing import List

try:
    import unified_planning as up
    import up_fast_downward  # ensure FD plugin is registered

    from unified_planning.io import PDDLReader
    try:
        from unified_planning.engines import OneshotPlanner
    except Exception:
        from unified_planning.shortcuts import OneshotPlanner
except Exception as e:
    print("[ERROR] unified-planning not available. Install `unified-planning[fast-downward]`.\n" \
          "Original import error: %s" % e, file=sys.stderr)
    sys.exit(2)

# Silence engine credits unless explicitly desired
try:
    up.shortcuts.get_environment().credits_stream = None
except Exception:
    pass


def _plan_to_lines(plan: up.plans.Plan) -> List[str]:
    """Return a simple list of action lines like ['ping main-server'] for sequential plans."""
    if plan is None:
        return []
    lines: List[str] = []
    try:
        # Sequential plan expected for this POC
        for ai in plan.actions:  # type: ignore[attr-defined]
            # ai is an ActionInstance
            name = ai.action.name
            params = []
            for obj in ai.actual_parameters:
                # actual_parameters are Objects or ConstantExpressions; prefer object .name
                if hasattr(obj, "object") and obj.object is not None:
                    params.append(obj.object.name)
                elif hasattr(obj, "name"):
                    params.append(obj.name)
                else:
                    params.append(str(obj))
            lines.append(" ".join([name] + params))
    except Exception:
        # Fallback to string printing
        raw = str(plan)
        lines = [raw]
    # Post-process fallback textual plan output (UP 1.2.0 prints a pretty plan)
    try:
        if len(lines) == 1 and "SequentialPlan" in lines[0]:
            raw = lines[0]
            # Extract lines after the header
            parts = raw.splitlines()
            cmds = []
            for row in parts:
                row = row.strip()
                if not row or row.startswith("SequentialPlan"):
                    continue
                # e.g., ping(main-server) -> ping main-server
                if row.endswith(")") and "(" in row:
                    name = row[: row.index("(")].strip()
                    args = row[row.index("(") + 1 : -1].strip()
                    if args:
                        params = [a.strip() for a in args.split(",")]
                        cmds.append(" ".join([name] + params))
                    else:
                        cmds.append(name)
                else:
                    cmds.append(row)
            if cmds:
                lines = cmds
    except Exception:
        pass
    return lines


def main() -> int:
    parser = argparse.ArgumentParser(description="Solve PDDL with Fast Downward via Unified Planning")
    parser.add_argument("--domain", required=True, help="Path to domain PDDL file")
    parser.add_argument("--problem", required=True, help="Path to problem PDDL file")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    parser.add_argument("--fd-search-config", dest="fd_search_config", default=None,
                        help="Fast Downward search config (string)")
    parser.add_argument("--fd-translate-options", dest="fd_translate_options", nargs='*', default=None,
                        help="Extra translate.py options (list)")
    parser.add_argument("--out", dest="out", default=None, help="Path to write JSON result (default: plans/<problem>.plan.json)")
    parser.add_argument("--validate", action="store_true", help="Validate returned plan against the problem")
    parser.add_argument("--quiet", action="store_true", help="Suppress normal stdout output (still writes file and errors)")

    # Anytime options
    parser.add_argument("--anytime", action="store_true", help="Use Fast Downward anytime planning mode")
    parser.add_argument("--anytime-alias", dest="anytime_alias", default="seq-sat-fdss-2", help="Anytime alias (default: seq-sat-fdss-2)")
    parser.add_argument("--time-limit", dest="time_limit", default=None, help="Search time limit (e.g., 20s, 2m)")

    args = parser.parse_args()

    # Read PDDL
    reader = PDDLReader()
    try:
        problem = reader.parse_problem(args.domain, args.problem)
    except Exception as e:
        msg = f"[ERROR] Failed to parse PDDL: {e}"
        payload = {"status": "ERROR", "stage": "parse", "error": str(e)}
        if args.out:
            try:
                with open(args.out, "w", encoding="utf-8") as f:
                    json.dump(payload, f, indent=2)
            except Exception as werr:
                print(f"[WARN] Failed to write --out file: {werr}", file=sys.stderr)
        if args.json:
            print(json.dumps(payload))
        else:
            print(msg, file=sys.stderr)
        return 2

    # Planner params
    params = {}
    if args.fd_search_config:
        params['fast_downward_search_config'] = args.fd_search_config
    if args.fd_translate_options:
        params['fast_downward_translate_options'] = args.fd_translate_options
    if args.anytime and args.anytime_alias:
        params['fast_downward_anytime_alias'] = args.anytime_alias
    if args.anytime and args.time_limit:
        params['fast_downward_search_time_limit'] = args.time_limit

    # Determine output path (default to problems/<problem_name>/plan.json, tying artifact to the problem)
    import os, hashlib
    pb_name = os.path.basename(args.problem)
    problem_dir = os.path.dirname(args.problem) or '.'
    problem_basename = os.path.splitext(pb_name)[0]
    if pb_name == 'problem.pddl':
        default_out = os.path.join(problem_dir, 'plan.json')
    else:
        default_out = os.path.join(problem_dir, problem_basename, 'plan.json')
    out_path = args.out or default_out
    try:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
    except Exception:
        pass

    # Compute content hashes to tie the artifact to domain+problem
    def _sha256(path: str) -> str:
        try:
            h = hashlib.sha256()
            with open(path, 'rb') as f:
                for chunk in iter(lambda: f.read(8192), b''):
                    h.update(chunk)
            return h.hexdigest()
        except Exception:
            return ''
    domain_sha = _sha256(args.domain)
    problem_sha = _sha256(args.problem)

    # Solve
    try:
        if args.anytime:
            # Import AnytimePlanner lazily for compatibility
            try:
                from unified_planning.engines import AnytimePlanner
            except Exception:
                from unified_planning.shortcuts import AnytimePlanner  # type: ignore
            best_result = None
            with AnytimePlanner(name='fast-downward', params=params) as planner:
                for res in planner.get_solutions(problem):
                    # Keep the last plan (final is best-so-far)
                    best_result = res
                    # Optionally stream intermediate (not required by user); keep silent if --quiet
                    if not args.quiet and not args.json and res.plan is not None and res.status.name == 'INTERMEDIATE':
                        print("Intermediate plan:")
                        for i, line in enumerate(_plan_to_lines(res.plan)):
                            print(f"{i}: {line}")
            if best_result is None:
                raise RuntimeError("Anytime planner returned no results")
            result = best_result
        else:
            with OneshotPlanner(name='fast-downward', params=params) as planner:
                result = planner.solve(problem)
    except Exception as e:
        msg = f"[ERROR] Planner invocation failed: {e}"
        payload = {"status": "ERROR", "stage": "planner", "error": str(e)}
        try:
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
        except Exception as werr:
            print(f"[WARN] Failed to write output file: {werr}", file=sys.stderr)
        if args.json and not args.quiet:
            print(json.dumps(payload))
        elif not args.json and not args.quiet:
            print(msg, file=sys.stderr)
        return 3

    status = result.status
    solved_statuses = {
        getattr(up.engines, 'PlanGenerationResultStatus').SOLVED_SATISFICING,
        getattr(up.engines, 'PlanGenerationResultStatus').SOLVED_OPTIMALLY,
    }

    if status in solved_statuses:
        lines = _plan_to_lines(result.plan)
        validation = None
        if args.validate:
            try:
                # Try multiple import locations across UP versions
                try:
                    from unified_planning.engines import PlanValidator
                except Exception:
                    PlanValidator = None  # type: ignore
                try:
                    from unified_planning.engines.results import ValidationResultStatus  # noqa: F401
                except Exception:
                    ValidationResultStatus = None  # type: ignore

                if PlanValidator is None:
                    validation = {"unavailable": f"PlanValidator not available in unified_planning {getattr(up, '__version__', 'unknown')}"}
                else:
                    pv = PlanValidator(problem_kind=problem.kind)
                    vres = pv.validate(problem, result.plan)
                    validation = {"status": getattr(vres.status, "name", str(vres.status))}
            except Exception as verr:
                validation = {"error": str(verr)}
        payload = {
            "status": "OK",
            "plan": lines,
            "actions": lines,
            "raw": str(result.plan),
            "domain_file": args.domain,
            "problem_file": args.problem,
            "domain_sha256": domain_sha,
            "problem_sha256": problem_sha
        }
        if validation is not None:
            payload["validation"] = validation
        try:
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
        except Exception as werr:
            print(f"[WARN] Failed to write output file: {werr}", file=sys.stderr)
        if args.json and not args.quiet:
            print(json.dumps(payload, indent=2))
        elif not args.json and not args.quiet:
            print("Plan found ({} steps):".format(len(lines)))
            for i, line in enumerate(lines):
                print(f"{i}: {line}")
            if validation is not None:
                print(f"Validation: {validation}")
            print(f"Wrote: {out_path}")
        return 0
    else:
        payload = {"status": "NO_PLAN", "detail": str(status)}
        try:
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
        except Exception as werr:
            print(f"[WARN] Failed to write output file: {werr}", file=sys.stderr)
        if args.json and not args.quiet:
            print(json.dumps(payload))
        elif not args.json and not args.quiet:
            print(f"No plan found. Status: {status}")
            print(f"Wrote: {out_path}")
        return 1


if __name__ == "__main__":
    sys.exit(main())

