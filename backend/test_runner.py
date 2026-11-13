"""
test_runner.py — Automated attack test runner
Runs all attacks on both Claude and Gemini, generates CSV results.
"""
import sys
import os
import csv
import json
from pathlib import Path
from datetime import datetime

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "attacks"))
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from all_attacks import (
    run_llm01, run_llm02, run_llm03, run_llm08, run_llm10,
    run_asi01, run_asi02, run_asi03, run_asi05, run_asi06, run_mcp,
)

RESULTS_DIR = Path(__file__).parent.parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)

MODELS = ["claude-3-5-sonnet", "gemini-1.5-flash"]

ATTACK_RUNNERS = {
    "LLM01": run_llm01,
    "LLM02": run_llm02,
    "LLM03": run_llm03,
    "LLM08": run_llm08,
    "LLM10": run_llm10,
    "ASI01": run_asi01,
    "ASI02": run_asi02,
    "ASI03": run_asi03,
    "ASI05": run_asi05,
    "ASI06": run_asi06,
    "MCP":   run_mcp,
}

CSV_FIELDS = [
    "risk_id", "case_id", "name", "model", "mitigation",
    "prompt", "response_preview", "result", "mitigation_desc"
]


def run_all_tests(models=None, risks=None, mitigations=(False, True)) -> list:
    """
    Run all attack tests for specified models and risks.
    
    Args:
        models: List of model names. Defaults to both Claude and Gemini.
        risks: List of risk IDs to run. Defaults to all.
        mitigations: Tuple of mitigation states to test. Default: (False, True).
    
    Returns:
        List of result dicts.
    """
    if models is None:
        models = MODELS
    if risks is None:
        risks = list(ATTACK_RUNNERS.keys())

    all_results = []
    total = len(models) * len(risks) * len(mitigations)
    done = 0

    print(f"\n{'='*70}")
    print(f"  OWASP AI SECURITY POC — AUTOMATED TEST RUNNER")
    print(f"  Models: {models}")
    print(f"  Risks:  {risks}")
    print(f"  Total test batches: {total}")
    print(f"{'='*70}\n")

    for model in models:
        for risk_id in risks:
            runner = ATTACK_RUNNERS.get(risk_id)
            if not runner:
                print(f"  [SKIP] Unknown risk: {risk_id}")
                continue

            for mit in mitigations:
                mit_label = "WITH mitigation" if mit else "WITHOUT mitigation"
                print(f"  ▶ [{risk_id}] {model} — {mit_label} ...")
                try:
                    results = runner(model=model, mitigation=mit)
                    all_results.extend(results)

                    # Print summary
                    for r in results:
                        icon = "✅" if r["result"] == "Blocked" else ("❌" if r["result"] == "Succeeded" else "⚠️")
                        print(f"      {icon} [{r['case_id']}] {r['name'][:50]}: {r['result']}")
                except Exception as e:
                    print(f"      ⛔ ERROR: {e}")

                done += 1
                print(f"  Progress: {done}/{total}\n")

    return all_results


def save_results_csv(results: list, filename: str = None) -> Path:
    """Save results to a CSV file."""
    if not filename:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"results_{ts}.csv"

    output_path = RESULTS_DIR / filename

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for row in results:
            # Ensure only CSV_FIELDS keys are written
            filtered = {k: row.get(k, "") for k in CSV_FIELDS}
            writer.writerow(filtered)

    print(f"\n✅ Results saved to: {output_path}")
    return output_path


def save_results_json(results: list, filename: str = None) -> Path:
    """Save results to a JSON file."""
    if not filename:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"results_{ts}.json"

    output_path = RESULTS_DIR / filename
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"✅ JSON results saved to: {output_path}")
    return output_path


def print_summary(results: list):
    """Print a summary table of results."""
    from collections import defaultdict

    print(f"\n{'='*70}")
    print("  RESULTS SUMMARY")
    print(f"{'='*70}")

    # Group by risk and model
    grouped = defaultdict(lambda: defaultdict(list))
    for r in results:
        key = f"{r['model']} ({'MIT' if r['mitigation'] else 'RAW'})"
        grouped[r["risk_id"]][key].append(r["result"])

    print(f"\n{'Risk ID':<10} {'Model/Mode':<35} {'Blocked':<10} {'Partial':<10} {'Succeeded':<12}")
    print("-" * 77)

    for risk_id in sorted(grouped.keys()):
        for model_key, results_list in sorted(grouped[risk_id].items()):
            blocked = results_list.count("Blocked")
            partial = results_list.count("Partial")
            succeeded = results_list.count("Succeeded")
            print(f"{risk_id:<10} {model_key:<35} {blocked:<10} {partial:<10} {succeeded:<12}")
        print()

    total = len(results)
    blocked = sum(1 for r in results if r["result"] == "Blocked")
    succeeded = sum(1 for r in results if r["result"] == "Succeeded")
    partial = sum(1 for r in results if r["result"] == "Partial")
    print(f"\nTotal: {total} | Blocked: {blocked} | Partial: {partial} | Succeeded: {succeeded}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="OWASP AI Security POC Test Runner")
    parser.add_argument("--models", nargs="+", default=MODELS, help="Models to test")
    parser.add_argument("--risks", nargs="+", default=None, help="Risk IDs to test (default: all)")
    parser.add_argument("--no-mitigation", action="store_true", help="Run only without mitigations")
    parser.add_argument("--only-mitigation", action="store_true", help="Run only with mitigations")
    parser.add_argument("--output", default=None, help="Output CSV filename")
    args = parser.parse_args()

    if args.no_mitigation:
        mit_states = (False,)
    elif args.only_mitigation:
        mit_states = (True,)
    else:
        mit_states = (False, True)

    results = run_all_tests(models=args.models, risks=args.risks, mitigations=mit_states)
    print_summary(results)
    save_results_csv(results, args.output)
    save_results_json(results)
