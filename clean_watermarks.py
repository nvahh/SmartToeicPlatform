import json
import os
import re
import shutil
import sys
import time
from pathlib import Path
import cv2
import numpy as np
from google import genai
from google.genai import types
from PIL import Image

PREFERRED_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.7-flash",
]


def parse_json_text(raw: str):
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


def detect_watermark_boxes(client: genai.Client, pil_img: Image.Image) -> list[list[float]]:
    prompt = (
        "Locate any overlaid watermark text, logo, or website banner stamped onto this TOEIC exam photo "
        "(for example text like 'Zenlish - Học TOEIC 1 lần là Đạt' or similar center branding). "
        "Do NOT select signs, labels, or text that naturally belong inside the real photograph scene. "
        "Return JSON: {\"boxes\": [[ymin, xmin, ymax, xmax]]} with coordinates normalized from 0 to 1000. "
        "Return {\"boxes\": []} if there is no watermark."
    )
    last_err = None
    for attempt in range(len(PREFERRED_MODELS) * 2):
        model = PREFERRED_MODELS[attempt % len(PREFERRED_MODELS)]
        try:
            resp = client.models.generate_content(
                model=model,
                contents=[pil_img, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.0,
                ),
            )
            data = parse_json_text(resp.text)
            raw_boxes = data if isinstance(data, list) else data.get("boxes", [])
            valid = []
            for item in raw_boxes:
                if isinstance(item, dict):
                    item = item.get("box_2d") or item.get("bbox") or item.get("box")
                if isinstance(item, list) and len(item) == 4:
                    valid.append([float(v) for v in item])
            return valid
        except Exception as exc:
            last_err = exc
            time.sleep(4)
    raise last_err


def read_cv2(path: Path) -> np.ndarray:
    buf = np.fromfile(str(path), dtype=np.uint8)
    return cv2.imdecode(buf, cv2.IMREAD_COLOR)


def write_cv2(path: Path, img: np.ndarray) -> None:
    ext = path.suffix.lower() or ".png"
    ok, encoded = cv2.imencode(ext, img)
    if not ok:
        raise RuntimeError(f"Khong the luu anh: {path}")
    encoded.tofile(str(path))


def clean_folder(folder: Path) -> None:
    if not os.environ.get("GEMINI_API_KEY"):
        raise RuntimeError("Thieu bien moi truong GEMINI_API_KEY.")

    exts = {".png", ".jpg", ".jpeg", ".webp"}
    files = sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in exts)
    if not files:
        print(f"Khong co file anh trong {folder}")
        return

    backup_dir = folder / "backup_orig"
    backup_dir.mkdir(exist_ok=True)
    client = genai.Client()

    for img_path in files:
        pil_img = Image.open(img_path).convert("RGB")
        boxes = detect_watermark_boxes(client, pil_img)
        if not boxes:
            print(f"[SKIP] Khong thay watermark: {img_path.name}")
            continue

        backup_path = backup_dir / img_path.name
        if not backup_path.exists():
            shutil.copy2(img_path, backup_path)

        cv_img = read_cv2(img_path)
        h, w = cv_img.shape[:2]
        mask = np.zeros((h, w), dtype=np.uint8)

        for ymin, xmin, ymax, xmax in boxes:
            y1 = max(0, int(ymin / 1000 * h) - 4)
            x1 = max(0, int(xmin / 1000 * w) - 4)
            y2 = min(h, int(ymax / 1000 * h) + 4)
            x2 = min(w, int(xmax / 1000 * w) + 4)
            mask[y1:y2, x1:x2] = 255

        cleaned = cv2.inpaint(cv_img, mask, 5, cv2.INPAINT_TELEA)
        write_cv2(img_path, cleaned)
        print(f"[CLEANED] {img_path.name} ({len(boxes)} vung)")
        time.sleep(2)


def main() -> None:
    if len(sys.argv) < 2:
        print("Cach dung: python clean_watermarks.py <thu_muc_anh>")
        sys.exit(1)
    clean_folder(Path(sys.argv[1]))


if __name__ == "__main__":
    main()
