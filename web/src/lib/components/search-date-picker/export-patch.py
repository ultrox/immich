import argparse
import os
import subprocess
import tempfile
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Export the date picker as a standalone upstream patch.")
    parser.add_argument("--base", required=True, help="Upstream commit without the date picker")
    parser.add_argument("--output", default=".scratch/date-picker.patch")
    args = parser.parse_args()
    root = Path(
        subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"], cwd=Path(__file__).parent, text=True
        ).strip()
    )
    base = subprocess.check_output(
        ["git", "rev-parse", "--verify", f"{args.base}^{{commit}}"], cwd=root, text=True
    ).strip()
    paths = [
        "i18n/en.json",
        "web/src/lib/components/shared-components/search-bar/SearchFilters.svelte",
        "web/src/lib/components/search-date-picker",
        "web/src/lib/managers/search-date-preferences-manager.svelte.ts",
    ]
    scratch = root / ".scratch"
    scratch.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="date-picker-export-", dir=scratch) as temp:
        env = {**os.environ, "GIT_INDEX_FILE": str(Path(temp) / "index")}
        subprocess.run(["git", "read-tree", base], cwd=root, env=env, check=True)
        subprocess.run(["git", "add", "--all", "--", *paths], cwd=root, env=env, check=True)
        patch = subprocess.check_output(
            ["git", "diff", "--cached", "--binary", "--full-index", "--no-ext-diff", base, "--", *paths],
            cwd=root,
            env=env,
        )
    output = (root / args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(patch)
    print(f"Upstream base: {base}")
    print(f"Patch: {output} ({len(patch)} bytes)")


if __name__ == "__main__":
    main()
