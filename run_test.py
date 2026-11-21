import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

REQUIRED_FILES = [
    "lc.pdf",
    "rc.pdf",
    "ans_lc.pdf",
    "ans_rc.pdf",
    "part1.mp3",
    "part2.mp3",
    "part3.mp3",
    "part4.mp3",
]


def normalize_files(raw_dir: Path, base_ans_dir: Path) -> None:
    for ans_name in ("ans_lc.pdf", "ans_rc.pdf"):
        dst = raw_dir / ans_name
        src = base_ans_dir / ans_name
        if not dst.is_file() and src.is_file():
            shutil.copy2(src, dst)
            print(f"[COPY] {src} -> {dst}")

    for item in list(raw_dir.iterdir()):
        if not item.is_file():
            continue
        fixed_name = re.sub(r"\.pdf\.pdf$", ".pdf", item.name, flags=re.IGNORECASE)
        fixed_name = re.sub(r"\.mp3\.mp3$", ".mp3", fixed_name, flags=re.IGNORECASE)
        if fixed_name != item.name:
            target = raw_dir / fixed_name
            if not target.exists():
                item.rename(target)
                item = target

        lower = item.name.lower()
        target_name = None

        if lower.endswith(".pdf"):
            if lower in ("lc.pdf", "rc.pdf", "ans_lc.pdf", "ans_rc.pdf"):
                continue
            is_answer = ("đáp án" in lower) or ("dap an" in lower) or ("ans" in lower)
            if is_answer and "lc" in lower:
                target_name = "ans_lc.pdf"
            elif is_answer and "rc" in lower:
                target_name = "ans_rc.pdf"
            elif "lc" in lower:
                target_name = "lc.pdf"
            elif "rc" in lower:
                target_name = "rc.pdf"
        elif lower.endswith(".mp3"):
            if lower in ("part1.mp3", "part2.mp3", "part3.mp3", "part4.mp3"):
                continue
            m = re.search(r"part\s*([1-4])", lower)
            if m:
                target_name = f"part{m.group(1)}.mp3"

        if target_name:
            target_path = raw_dir / target_name
            if not target_path.exists():
                item.rename(target_path)
                print(f"[RENAME] {item.name} -> {target_name}")


def main() -> None:
    if len(sys.argv) < 2 or not sys.argv[1].isdigit():
        print("Cach dung: python run_test.py <so_test> [--build-only | --import-only]")
        sys.exit(1)

    test_num = int(sys.argv[1])
    flags = set(sys.argv[2:])
    build_only = "--build-only" in flags
    import_only = "--import-only" in flags

    raw_dir = Path("raw_ets") / f"test{test_num}"
    out_dir = Path("exam_packages") / f"ets_2024_test_{test_num:02d}"
    title = f"ETS TOEIC 2024 - Test {test_num:02d}"

    raw_dir.mkdir(parents=True, exist_ok=True)

    if not import_only:
        normalize_files(raw_dir, Path("raw_ets") / "test1")
        missing = [f for f in REQUIRED_FILES if not (raw_dir / f).is_file()]
        if missing:
            print(f"[THIEU FILE] Trong {raw_dir} dang thieu:")
            for f in missing:
                print(f"  - {f}")
            sys.exit(1)

        if not os.environ.get("GEMINI_API_KEY"):
            print("[LOI] Chua gan GEMINI_API_KEY. Chay: $env:GEMINI_API_KEY=\"YOUR_KEY\"")
            sys.exit(1)

        subprocess.run(
            [
                sys.executable,
                "build_ets_package.py",
                str(raw_dir),
                str(out_dir),
                str(test_num),
                title,
            ],
            check=True,
        )

    if not build_only:
        subprocess.run(
            [sys.executable, "import_exam_package.py", str(out_dir)],
            check=True,
        )


if __name__ == "__main__":
    main()
