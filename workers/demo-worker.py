#!/usr/bin/env python3
"""
Demo worker for Unclaimed Bloom.

Emits JSON progress lines to stdout that WorkerRunner can parse.
Use --fail to simulate a worker failure.
Use --items N to control the number of items (default 20).

Progress line format:
  {"progress": {"current": N, "total": N, "msg": "..."}}
"""
import json
import sys
import time

ITEMS_DEFAULT = 20


def emit_progress(current: int, total: int, msg: str) -> None:
    print(json.dumps({"progress": {"current": current, "total": total, "msg": msg}}), flush=True)


def main() -> None:
    args = sys.argv[1:]
    fail = "--fail" in args
    total = ITEMS_DEFAULT

    if "--items" in args:
        idx = args.index("--items")
        if idx + 1 < len(args):
            try:
                total = int(args[idx + 1])
            except ValueError:
                print(f"demo-worker: invalid --items value: {args[idx + 1]}", file=sys.stderr)
                sys.exit(1)

    print(f"demo-worker: starting ({total} items)", flush=True)

    for i in range(1, total + 1):
        emit_progress(i, total, f"processing item_{i:04d}.svg")
        time.sleep(0.05)

        if fail and i == total // 2:
            print(f"demo-worker: intentional failure at item {i}", file=sys.stderr)
            sys.exit(1)

    print(f"demo-worker: done ({total}/{total})", flush=True)


if __name__ == "__main__":
    main()
