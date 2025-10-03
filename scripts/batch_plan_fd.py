#!/usr/bin/env python3
"""
Batch runner for planning multiple PDDL problems with Unified Planning + Fast Downward.

Examples:
  python scripts/batch_plan_fd.py --domain rogue-devops-poc-domain.pddl --problems-glob "*.pddl"
  python scripts/batch_plan_fd.py --domain rogue-devops-poc-domain.pddl --problems-glob "poc-*.pddl" --anytime --time-limit 20s

Notes:
- For each problem, this invokes scripts/plan_fd.py which writes a JSON plan file to plans/<problem>.plan.json by default.
- Use --quiet to reduce noise.
"""
from __future__ import annotations
import argparse
import glob
import os
import subprocess
import sys
from typing import List


def run_one(domain: str, problem: str, extra_args: List[str]) -> int:
    cmd = [sys.executable, 'scripts/plan_fd.py', '--domain', domain, '--problem', problem]
    cmd += extra_args
    # Ensure quiet so output is not interleaved; plan_fd writes plan file by default
    if '--quiet' not in cmd:
        cmd.append('--quiet')
    print(f"[batch] Running: {' '.join(cmd)}")
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        print(f"[batch] ERROR rc={proc.returncode} for {problem}\nstdout:\n{proc.stdout}\nstderr:\n{proc.stderr}")
    else:
        # plan_fd prints nothing in quiet; default is problems/<problem_name>/plan.json
        pb_name = os.path.basename(problem)
        if pb_name == 'problem.pddl':
            out_path = os.path.join(os.path.dirname(problem) or '.', 'plan.json')
        else:
            pb = os.path.splitext(pb_name)[0]
            out_path = os.path.join(os.path.dirname(problem) or '.', pb, 'plan.json')
        ok = os.path.exists(out_path)
        print(f"[batch] OK {problem} -> {out_path} ({'exists' if ok else 'missing'})")
    return proc.returncode


def main() -> int:
    ap = argparse.ArgumentParser(description='Batch plan multiple problems')
    ap.add_argument('--domain', required=True, help='Path to domain PDDL file')
    ap.add_argument('--problems-glob', required=True, help='Glob for problem files (e.g., ".pddl" or "poc-*.pddl")')
    ap.add_argument('--anytime', action='store_true', help='Use anytime planner')
    ap.add_argument('--anytime-alias', default='seq-sat-fdss-2', help='Anytime alias')
    ap.add_argument('--time-limit', default=None, help='Search time limit (e.g., 20s)')
    ap.add_argument('--json', action='store_true', help='Also print JSON to stdout for each plan')
    ap.add_argument('--validate', action='store_true', help='Attempt to validate each plan')
    ap.add_argument('--fd-search-config', default=None)
    ap.add_argument('--fd-translate-options', nargs='*', default=None)
    args = ap.parse_args()

    problems = sorted(glob.glob(args.problems_glob))
    if not problems:
        print(f"[batch] No problems match: {args.problems_glob}")
        return 1

    extra: List[str] = []
    if args.anytime:
        extra += ['--anytime', '--anytime-alias', args.anytime_alias]
        if args.time_limit:
            extra += ['--time-limit', args.time_limit]
    if args.json:
        extra += ['--json']
    if args.validate:
        extra += ['--validate']
    if args.fd_search_config:
        extra += ['--fd-search-config', args.fd_search_config]
    if args.fd_translate_options:
        extra += ['--fd-translate-options'] + args.fd_translate_options

    rc = 0
    for p in problems:
        r = run_one(args.domain, p, extra)
        if r != 0:
            rc = r
    return rc


if __name__ == '__main__':
    sys.exit(main())

