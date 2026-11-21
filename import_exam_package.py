import json
import sys
from pathlib import Path
import requests

API_BASE = "http://localhost:5204/api"
ADMIN_EMAIL = "admin@smarttoeic.com"
ADMIN_PASSWORD = "Admin@123"

EXPECTED_PART_COUNTS = {
    1: 6,
    2: 25,
    3: 39,
    4: 30,
    5: 30,
    6: 16,
    7: 54,
}


def login_admin() -> str:
    resp = requests.post(
        f"{API_BASE}/Auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["accessToken"]


def validate_exam(data: dict, package_dir: Path, strict_200: bool) -> list[str]:
    errors = []
    groups = data.get("questionGroups", [])
    part_counts = {p: 0 for p in range(1, 8)}
    question_numbers = []

    for idx, group in enumerate(groups, start=1):
        part = group.get("partNumber")
        if part not in part_counts:
            errors.append(f"Group #{idx}: partNumber khong hop le ({part})")
            continue

        for field in ("audioUrl", "imageUrl"):
            val = group.get(field)
            if val and not val.startswith(("/uploads/", "http://", "https://")):
                local_file = package_dir / val
                if not local_file.is_file():
                    errors.append(f"Group #{idx} (Part {part}): thieu file {local_file}")

        if part == 1 and not group.get("imageUrl"):
            errors.append(f"Group #{idx} (Part 1): thieu imageUrl")
        if part in (1, 2, 3, 4) and not group.get("audioUrl"):
            errors.append(f"Group #{idx} (Part {part}): thieu audioUrl")

        questions = group.get("questions", [])
        part_counts[part] += len(questions)
        for q in questions:
            q_num = q.get("questionNumber")
            question_numbers.append(q_num)
            ans = str(q.get("correctOption", "")).strip().upper()
            if ans not in ("A", "B", "C", "D"):
                errors.append(f"Cau {q_num}: correctOption khong hop le ({ans})")

    if strict_200:
        for part, expected in EXPECTED_PART_COUNTS.items():
            actual = part_counts[part]
            if actual != expected:
                errors.append(f"Part {part}: co {actual} cau (chuan phai la {expected})")

        unique_nums = set(question_numbers)
        if len(question_numbers) != 200 or unique_nums != set(range(1, 201)):
            missing = sorted(set(range(1, 201)) - unique_nums)
            errors.append(f"Tong so cau khong khop 1..200. Thieu: {missing[:15]}")

    return errors


def upload_media(file_path: Path, token: str, cache: dict[Path, str]) -> str:
    resolved = file_path.resolve()
    if resolved in cache:
        return cache[resolved]

    with open(resolved, "rb") as f:
        resp = requests.post(
            f"{API_BASE}/Media/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": (resolved.name, f)},
            timeout=120,
        )
    resp.raise_for_status()
    url = resp.json()["url"]
    cache[resolved] = url
    return url


def import_package(package_dir: Path, strict_200: bool) -> None:
    json_path = package_dir / "exam.json"
    if not json_path.is_file():
        raise FileNotFoundError(f"Khong tim thay {json_path}")

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    errors = validate_exam(data, package_dir, strict_200)
    if errors:
        print(f"[LOI] Kiem tra that bai cho {package_dir.name}:")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)

    token = login_admin()
    upload_cache: dict[Path, str] = {}

    for group in data.get("questionGroups", []):
        for field in ("audioUrl", "imageUrl"):
            val = group.get(field)
            if val and not val.startswith(("/uploads/", "http://", "https://")):
                local_file = package_dir / val
                uploaded_url = upload_media(local_file, token, upload_cache)
                group[field] = uploaded_url
                print(f"[UPLOAD] {val} -> {uploaded_url}")

    resp = requests.post(
        f"{API_BASE}/Exams/bulk-import",
        headers={"Authorization": f"Bearer {token}"},
        json=data,
        timeout=120,
    )
    resp.raise_for_status()
    result = resp.json()
    total_q = sum(len(g.get("questions", [])) for g in result.get("questionGroups", []))
    print(f"[THANH CONG] Da import '{result['title']}' ({total_q} cau) | ExamId: {result['id']}")


def main() -> None:
    args = [a for a in sys.argv[1:] if a != "--no-strict"]
    strict_200 = "--no-strict" not in sys.argv[1:]

    if not args:
        print("Cach dung: python import_exam_package.py <thu_muc_de_1> [thu_muc_de_2 ...] [--no-strict]")
        sys.exit(1)

    for folder in args:
        import_package(Path(folder), strict_200)


if __name__ == "__main__":
    main()
