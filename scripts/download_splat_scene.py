#!/usr/bin/env python3
"""
Download and build 3D Gaussian Splatting scenes for Prismatic personas.

Usage:
  python3 scripts/download_splat_scene.py                    # Interactive menu
  python3 scripts/download_splat_scene.py --list             # List available scenes
  python3 scripts/download_splat_scene.py --scene playroom   # Download specific scene
  python3 scripts/download_splat_scene.py --build input.ply  # Build LoD for a .ply file
  python3 scripts/download_splat_scene.py --all              # Download all demo scenes

Note on persona scans:
  For real persona 3D scenes (steve-jobs, elon-musk), use:
    1. marble.worldlabs.ai — text/image → 3DGS (recommended)
    2. Polycam (iPhone) — LiDAR/photo scan → export as .ply
    3. Metashape — professional photogrammetry
  Then place .ply files in public/splats/ and run --build

Available demo scenes (direct download from wlt-ai-cdn.art):
  spaceship  (~132MB) — Spaceship interior (smallest)
  playroom   (~139MB)  — Indoor playroom
  stump      (~297MB)  — Tree stump
  garden     (~340MB)  — Garden
  bicycle    (~366MB)  — Bicycle
  ruins      (~557MB)  — Ancient ruins
  hobbiton   (~573MB)  — Hobbiton village
  coit-40m  (~1280MB) — Coit Tower SF
  cave       (~1450MB) — Cave (largest)
"""

import argparse
import json
import os
import subprocess
import sys
import urllib.request
import urllib.error
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
PUBLIC_SPLATS = PROJECT_ROOT / "public" / "splats"

SCENES = {
    "spaceship": {
        "url": "https://wlt-ai-cdn.art/spark-2.0/rad/spaceship-lod.rad",
        "size_mb": 132,
        "desc": "Spaceship interior (World Labs, smallest)",
    },
    "playroom": {
        "url": "https://wlt-ai-cdn.art/spark-2.0/rad/playroom-lod.rad",
        "size_mb": 139,
        "desc": "Indoor playroom (World Labs)",
    },
    "stump": {
        "url": "https://wlt-ai-cdn.art/spark-2.0/rad/stump-lod.rad",
        "size_mb": 297,
        "desc": "Tree stump (World Labs)",
    },
    "garden": {
        "url": "https://wlt-ai-cdn.art/spark-2.0/rad/garden-lod.rad",
        "size_mb": 340,
        "desc": "Garden scene (World Labs)",
    },
    "bicycle": {
        "url": "https://wlt-ai-cdn.art/spark-2.0/rad/bicycle-lod.rad",
        "size_mb": 366,
        "desc": "Bicycle (World Labs)",
    },
    "ruins": {
        "url": "https://wlt-ai-cdn.art/spark-2.0/rad/ruins-lod.rad",
        "size_mb": 557,
        "desc": "Ancient ruins (World Labs)",
    },
    "hobbiton": {
        "url": "https://wlt-ai-cdn.art/spark-2.0/rad/hobbiton-lod.rad",
        "size_mb": 573,
        "desc": "Hobbiton village (World Labs)",
    },
    "coit-40m": {
        "url": "https://wlt-ai-cdn.art/spark-2.0/rad/coit-40m-sh1-lod.rad",
        "size_mb": 1280,
        "desc": "Coit Tower SF 40M splats (World Labs)",
    },
    "cave": {
        "url": "https://wlt-ai-cdn.art/spark-2.0/rad/cave-lod.rad",
        "size_mb": 1450,
        "desc": "Cave exploration (World Labs, largest)",
    },
}


def ensure_dir():
    PUBLIC_SPLATS.mkdir(parents=True, exist_ok=True)
    return PUBLIC_SPLATS


def download_scene(name, quiet=False):
    """Download a .rad scene file from World Labs CDN."""
    scene = SCENES[name]
    dest = PUBLIC_SPLATS / f"{name}-lod.rad"

    if dest.exists():
        size_mb = dest.stat().st_size // 1024 // 1024
        print(f"  [SKIP] {name}-lod.rad already exists ({size_mb}MB)")
        return dest

    print(f"  Downloading {name}-lod.rad (~{scene['size_mb']}MB)...")

    def reporthook(block_num, block_size, total_size):
        downloaded = block_num * block_size
        pct = min(100, downloaded * 100 // total_size) if total_size > 0 else 0
        if not quiet:
            bar_len = 40
            filled = bar_len * pct // 100
            bar = "=" * filled + "-" * (bar_len - filled)
            print(f"\r    [{bar}] {pct}%", end="", flush=True)

    try:
        urllib.request.urlretrieve(scene["url"], dest, reporthook)
        if not quiet:
            print()
        size_mb = dest.stat().st_size // 1024 // 1024
        print(f"  [OK] Saved to splats/{name}-lod.rad ({size_mb}MB)")
        return dest
    except (urllib.error.HTTPError, urllib.error.URLError) as e:
        if dest.exists():
            dest.unlink()
        raise RuntimeError(f"Download failed for {name}: {e}")


def build_lod(input_path, output_name, quality=False):
    """
    Build LoD tree for a splat file.

    Requires: Rust toolchain + compiled build-lod binary.
    Pre-build once:
      cd spark-src/rust && cargo build --release -p build-lod
    """
    build_lod_bin = PROJECT_ROOT / "spark-src" / "rust" / "target" / "release" / "build-lod"
    if not build_lod_bin.exists():
        raise RuntimeError(
            f"build-lod binary not found at {build_lod_bin}\n"
            "Pre-build: cd spark-src/rust && cargo build --release -p build-lod"
        )

    method_flag = ["--quality"] if quality else ["--quick"]
    output_dir = PUBLIC_SPLATS
    output_dir.mkdir(parents=True, exist_ok=True)

    cmd = [str(build_lod_bin), str(input_path)] + method_flag + ["--rad-chunked"]
    print(f"  Building LoD: {' '.join(cmd)}")

    result = subprocess.run(
        cmd, cwd=str(PROJECT_ROOT), capture_output=True, text=True
    )

    if result.returncode != 0:
        raise RuntimeError(f"build-lod failed:\n{result.stderr}")

    # Locate generated .rad + .radc files
    suffix = "-lod"
    rad_file = next(output_dir.glob(f"{output_name}{suffix}.rad"), None)
    radc_files = sorted(output_dir.glob(f"{output_name}{suffix}-*.radc"))

    if not rad_file:
        raise RuntimeError(f"build-lod succeeded but no .rad found in {output_dir}")

    print(f"  Generated: {rad_file.name} + {len(radc_files)} .radc chunk(s)")
    return [rad_file] + list(radc_files)


def main():
    parser = argparse.ArgumentParser(
        description="Download or build 3DGS scene files for Prismatic",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--scene", choices=list(SCENES.keys()), help="Download specific scene")
    parser.add_argument("--all", action="store_true", help="Download all demo scenes")
    parser.add_argument("--list", action="store_true", help="List available scenes and exit")
    parser.add_argument("--build", metavar="FILE", help="Build LoD for .ply/.spz file")
    parser.add_argument("--output-name", help="Output name (default: inferred from filename)")
    parser.add_argument("--quality", action="store_true", help="Use quality (slow) LoD method")
    parser.add_argument("--quiet", "-q", action="store_true", help="Suppress progress bars")
    args = parser.parse_args()

    if args.list:
        print("Available demo scenes:")
        for name, info in SCENES.items():
            print(f"  {name:<12} {info['size_mb']:>5}MB  {info['desc']}")
        print()
        return

    scenes_to_download = []
    if args.all:
        scenes_to_download = list(SCENES.keys())
    elif args.scene:
        scenes_to_download = [args.scene]
    elif args.build:
        input_path = Path(args.build)
        if not input_path.exists():
            print(f"Error: File not found: {input_path}", file=sys.stderr)
            sys.exit(1)
        name = args.output_name or input_path.stem.replace("-lod", "")
        print(f"Building LoD for {input_path.name}...")
        try:
            files = build_lod(input_path, name, quality=args.quality)
            print("Generated files:")
            for f in files:
                size_mb = f.stat().st_size // 1024 // 1024
                print(f"  {f.relative_to(PROJECT_ROOT)} ({size_mb}MB)")
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)
        return
    else:
        parser.print_help()
        print()
        print("Quick start:")
        print("  python3 scripts/download_splat_scene.py --list")
        print("  python3 scripts/download_splat_scene.py --scene spaceship")
        print("  python3 scripts/download_splat_scene.py --build my-scan.ply --quality")
        return

    ensure_dir()
    print(f"Downloading {len(scenes_to_download)} scene(s) to public/splats/")
    print()

    for name in scenes_to_download:
        try:
            download_scene(name, quiet=args.quiet)
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
