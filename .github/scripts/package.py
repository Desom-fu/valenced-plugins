#!/usr/bin/env python3
"""Packages the plugins listed in $PLAN (releases.json) into build/dist/<id>@<version>.zip.

The template does this in Gradle (`package<Name>` ZIP tasks). JS-only plugins need none of that:
their archive is just the manifest plus the bundled index.js, so packaging is a plain zip. A plugin
that carries native code (`dist.android` plus `src/main/`) still has to go through Gradle, so this
script refuses loudly instead of producing an archive that would install broken.

Usage: PLAN=releases.json package.py [--plugins-dir plugins]
"""

import argparse
import json
import os
import sys
import zipfile

# Fixed timestamp + explicit attributes keep the archive digest stable across runs, so
# `generate-index` produces the same sha256 for an unchanged plugin.
ZIP_EPOCH = (1980, 1, 1, 0, 0, 0)


def die(msg):
    print(f"::error::{msg}", file=sys.stderr)
    sys.exit(1)


def add_file(zf, src, arcname):
    info = zipfile.ZipInfo(arcname, date_time=ZIP_EPOCH)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    with open(src, "rb") as fh:
        zf.writestr(info, fh.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", default=os.environ.get("PLAN", "releases.json"))
    ap.add_argument("--plugins-dir", default="plugins")
    args = ap.parse_args()

    if not os.path.isfile(args.plan):
        die(f"no release plan at {args.plan}")

    with open(args.plan, encoding="utf-8") as fh:
        plan = json.load(fh)

    print(f"Packaging {len(plan)} plugin(s)")

    for release in plan:
        name = release["name"]
        zip_path = release["zip"]
        plugin_dir = os.path.join(args.plugins_dir, name)
        manifest_path = os.path.join(plugin_dir, "manifest.json")

        if not os.path.isfile(manifest_path):
            die(f"no manifest at {manifest_path}")

        with open(manifest_path, encoding="utf-8") as fh:
            manifest = json.load(fh)

        plugin_id = manifest.get("id")
        version = manifest.get("version")
        dist = manifest.get("dist") or {}
        script_rel = dist.get("script")
        android_rel = (dist.get("android") or {}).get("path")

        if not script_rel:
            die(f"{name} declares no dist.script")

        if android_rel and os.path.isdir(os.path.join(plugin_dir, "src", "main")):
            die(f"{name} is a native plugin; this repo has no Gradle packaging step")

        # The CLI writes the bundle to <plugin>/build/js/<dist.script>.
        bundle = os.path.join(plugin_dir, "build", "js", script_rel)
        if not os.path.isfile(bundle):
            die(f"missing {bundle}; did the JS build run?")

        os.makedirs(os.path.dirname(zip_path) or ".", exist_ok=True)
        if os.path.exists(zip_path):
            os.remove(zip_path)

        with zipfile.ZipFile(zip_path, "w") as zf:
            add_file(zf, manifest_path, "manifest.json")
            add_file(zf, bundle, script_rel)

        print(f"Packaged {plugin_id} {version} -> {zip_path} ({os.path.getsize(zip_path)} bytes)")

    # The plan is authoritative: an artifact it names but we did not write is a hard failure.
    missing = [r["zip"] for r in plan if not os.path.isfile(r["zip"])]
    if missing:
        die("missing artifacts: " + ", ".join(missing))

    print("Packaging complete.")


if __name__ == "__main__":
    main()
