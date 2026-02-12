#!/usr/bin/env python3
"""
Benchmark Codex CLI end-to-end latency in a repeatable way.

Why this exists:
- "Feels faster" is hard to reason about; this records numbers (p50/p90).
- If you can log into two accounts (Pro vs non-Pro), you can run the exact
  same benchmark and compare distributions.

This measures:
- wall_s: total wall-clock time for `codex exec` to finish
- agent_message_s: time until the `agent_message` item is emitted (approx what you see)
- output_tokens, cached_input_tokens: from the JSONL `turn.completed` usage block
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Optional


DEFAULT_PROMPT = (
    "Without using any tools, output exactly 200 integers from 1 to 200, "
    "separated by a single space, and nothing else."
)


@dataclass(frozen=True)
class RunResult:
    run_idx: int
    started_at_iso: str
    wall_s: float
    agent_message_s: Optional[float]
    input_tokens: Optional[int]
    cached_input_tokens: Optional[int]
    output_tokens: Optional[int]
    exit_code: int


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _percentile(sorted_vals: list[float], p: float) -> float:
    if not sorted_vals:
        raise ValueError("no values")
    if p <= 0:
        return sorted_vals[0]
    if p >= 100:
        return sorted_vals[-1]
    k = (len(sorted_vals) - 1) * (p / 100.0)
    f = int(k)
    c = min(f + 1, len(sorted_vals) - 1)
    if f == c:
        return sorted_vals[f]
    d0 = sorted_vals[f] * (c - k)
    d1 = sorted_vals[c] * (k - f)
    return d0 + d1


def _iter_json_lines(raw: str) -> Iterable[dict[str, Any]]:
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            yield json.loads(line)
        except json.JSONDecodeError:
            # codex logs can show up on stdout in some environments; ignore.
            continue


def _extract_usage(events: list[dict[str, Any]]) -> tuple[Optional[int], Optional[int], Optional[int]]:
    for ev in reversed(events):
        if ev.get("type") == "turn.completed":
            usage = ev.get("usage") or {}
            return (
                usage.get("input_tokens"),
                usage.get("cached_input_tokens"),
                usage.get("output_tokens"),
            )
    return (None, None, None)


def _extract_agent_message_time(events_with_times: list[tuple[float, dict[str, Any]]]) -> Optional[float]:
    for t, ev in events_with_times:
        if ev.get("type") != "item.completed":
            continue
        item = ev.get("item") or {}
        if item.get("type") == "agent_message":
            return t
    return None


def _run_once(
    *,
    run_idx: int,
    model: Optional[str],
    prompt: str,
    sandbox_mode: str,
    extra_codex_args: list[str],
    cwd: Optional[Path],
    timeout_s: int,
    env: dict[str, str],
) -> RunResult:
    cmd = ["codex", "exec", "--json", "-s", sandbox_mode]
    if model:
        cmd += ["-m", model]
    cmd += extra_codex_args
    cmd += [prompt]

    started_at = _utc_now_iso()
    t0 = time.perf_counter()

    # We want to approximate "time to agent message" which is close to what a
    # user experiences, even though the JSONL stream isn't per-token streaming.
    proc = subprocess.Popen(
        cmd,
        cwd=str(cwd) if cwd else None,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )

    stdout_chunks: list[str] = []
    stderr_chunks: list[str] = []
    events: list[dict[str, Any]] = []
    events_with_times: list[tuple[float, dict[str, Any]]] = []

    try:
        assert proc.stdout is not None
        assert proc.stderr is not None

        # Read stdout line-by-line to timestamp key events.
        # Also drain stderr at the end (stderr is mostly noisy logs).
        while True:
            if (time.perf_counter() - t0) > timeout_s:
                proc.kill()
                raise TimeoutError(f"codex exec timed out after {timeout_s}s")

            line = proc.stdout.readline()
            if line:
                stdout_chunks.append(line)
                try:
                    ev = json.loads(line)
                    events.append(ev)
                    events_with_times.append((time.perf_counter() - t0, ev))
                except json.JSONDecodeError:
                    pass
                continue

            if proc.poll() is not None:
                break

            time.sleep(0.01)

        stderr_chunks.append(proc.stderr.read() or "")
    finally:
        # Ensure pipes are closed.
        try:
            if proc.stdout:
                proc.stdout.close()
        except Exception:
            pass
        try:
            if proc.stderr:
                proc.stderr.close()
        except Exception:
            pass

    t1 = time.perf_counter()
    wall_s = t1 - t0
    exit_code = proc.returncode or 0

    if not events:
        # Fallback parsing in case the line-by-line loop missed buffered output.
        events = list(_iter_json_lines("".join(stdout_chunks)))

    input_tokens, cached_input_tokens, output_tokens = _extract_usage(events)
    agent_message_s = _extract_agent_message_time(events_with_times)

    return RunResult(
        run_idx=run_idx,
        started_at_iso=started_at,
        wall_s=wall_s,
        agent_message_s=agent_message_s,
        input_tokens=input_tokens,
        cached_input_tokens=cached_input_tokens,
        output_tokens=output_tokens,
        exit_code=exit_code,
    )


def _fmt_opt_int(v: Optional[int]) -> str:
    return "-" if v is None else str(v)


def _fmt_opt_float(v: Optional[float]) -> str:
    return "-" if v is None else f"{v:.3f}"


def _print_run_row(r: RunResult) -> None:
    toks_per_s = None
    if r.output_tokens is not None and r.wall_s > 0:
        toks_per_s = r.output_tokens / r.wall_s
    print(
        f"{r.run_idx:>3d}  wall={r.wall_s:>6.3f}s  msg={_fmt_opt_float(r.agent_message_s):>6}s  "
        f"out_tok={_fmt_opt_int(r.output_tokens):>5}  cached_in={_fmt_opt_int(r.cached_input_tokens):>5}  "
        f"tok/s={'-' if toks_per_s is None else f'{toks_per_s:.1f}':>6}  exit={r.exit_code}"
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Benchmark Codex CLI latency (codex exec --json).")
    ap.add_argument("--runs", type=int, default=10, help="Number of measured runs (default: 10)")
    ap.add_argument("--warmup", type=int, default=1, help="Number of warmup runs (default: 1)")
    ap.add_argument("--model", type=str, default=None, help='Codex model (default: Codex config, e.g. "gpt-5.3-codex")')
    ap.add_argument("--prompt", type=str, default=DEFAULT_PROMPT, help="Prompt to benchmark")
    ap.add_argument(
        "--sandbox",
        type=str,
        default="read-only",
        choices=["read-only", "workspace-write", "danger-full-access"],
        help="Sandbox policy to use for model-generated commands (default: read-only)",
    )
    ap.add_argument(
        "--cd",
        type=str,
        default=None,
        help="Working directory to run from (default: current directory)",
    )
    ap.add_argument("--timeout-s", type=int, default=120, help="Timeout per run (default: 120)")
    ap.add_argument("--label", type=str, default=None, help="Optional label (e.g. pro/nonpro) to include in output JSONL")
    ap.add_argument("--out", type=str, default=None, help="Optional JSONL output path for later comparison")
    ap.add_argument(
        "--extra-arg",
        action="append",
        default=[],
        help="Extra arg to pass to `codex exec` (repeatable). Example: --extra-arg -c --extra-arg model=\"gpt-5.3-codex\"",
    )
    args = ap.parse_args()

    if args.runs <= 0:
        ap.error("--runs must be > 0")
    if args.warmup < 0:
        ap.error("--warmup must be >= 0")

    cwd = Path(args.cd).resolve() if args.cd else Path.cwd()

    env = dict(os.environ)
    # Keep output stable-ish: avoid locale formatting differences in subprocesses.
    env.setdefault("LC_ALL", "C")
    env.setdefault("LANG", "C")

    out_path = Path(args.out).resolve() if args.out else None
    out_f = None
    if out_path:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_f = out_path.open("a", encoding="utf-8")

    def write_out(obj: dict[str, Any]) -> None:
        if not out_f:
            return
        out_f.write(json.dumps(obj, sort_keys=True) + "\n")
        out_f.flush()

    try:
        if args.warmup:
            print(f"Warmup: {args.warmup} run(s) (discarded)")
            for i in range(1, args.warmup + 1):
                _ = _run_once(
                    run_idx=i,
                    model=args.model,
                    prompt=args.prompt,
                    sandbox_mode=args.sandbox,
                    extra_codex_args=args.extra_arg,
                    cwd=cwd,
                    timeout_s=args.timeout_s,
                    env=env,
                )
            print("")

        print(f"Measured: {args.runs} run(s)")
        print(" idx  wall        msg        out_tok  cached_in  tok/s   exit")
        results: list[RunResult] = []
        for i in range(1, args.runs + 1):
            r = _run_once(
                run_idx=i,
                model=args.model,
                prompt=args.prompt,
                sandbox_mode=args.sandbox,
                extra_codex_args=args.extra_arg,
                cwd=cwd,
                timeout_s=args.timeout_s,
                env=env,
            )
            results.append(r)
            _print_run_row(r)

            write_out(
                {
                    "label": args.label,
                    "run_idx": r.run_idx,
                    "started_at_iso": r.started_at_iso,
                    "wall_s": r.wall_s,
                    "agent_message_s": r.agent_message_s,
                    "input_tokens": r.input_tokens,
                    "cached_input_tokens": r.cached_input_tokens,
                    "output_tokens": r.output_tokens,
                    "exit_code": r.exit_code,
                    "model": args.model,
                    "sandbox": args.sandbox,
                    "cwd": str(cwd),
                }
            )

        ok = [r for r in results if r.exit_code == 0]
        if not ok:
            print("\nNo successful runs to summarize.")
            return 2

        wall = sorted(r.wall_s for r in ok)
        msg_times = sorted(r.agent_message_s for r in ok if r.agent_message_s is not None)
        out_toks = [r.output_tokens for r in ok if r.output_tokens is not None]

        print("\nSummary (successful runs):")
        print(f"- wall_s: p50={_percentile(wall, 50):.3f}  p90={_percentile(wall, 90):.3f}  min={min(wall):.3f}  max={max(wall):.3f}")
        if msg_times:
            print(
                f"- agent_message_s: p50={_percentile(msg_times, 50):.3f}  p90={_percentile(msg_times, 90):.3f}  "
                f"min={min(msg_times):.3f}  max={max(msg_times):.3f}"
            )
        if out_toks:
            print(f"- output_tokens: median={statistics.median(out_toks)}")
        print("")
        if out_path:
            print(f"Wrote results to: {out_path}")
    finally:
        if out_f:
            out_f.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

