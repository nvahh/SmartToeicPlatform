import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
import pymupdf as fitz
import imageio_ffmpeg
from google import genai
from google.genai import types
import shutil
import cv2
import numpy as np
from PIL import Image

MODEL_NAME = "gemini-3.8-flash"


def parse_json_text(raw: str) -> dict:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


def upload_and_wait(client: genai.Client, file_path: Path):
    uploaded = client.files.upload(file=str(file_path))
    while getattr(uploaded.state, "name", "") == "PROCESSING":
        time.sleep(2)
        uploaded = client.files.get(name=uploaded.name)
    if getattr(uploaded.state, "name", "") == "FAILED":
        raise RuntimeError(f"Upload failed: {file_path}")
    return uploaded


_CANDIDATE_MODELS: list[str] = []


def get_candidate_models(client: genai.Client) -> list[str]:
    global _CANDIDATE_MODELS
    if _CANDIDATE_MODELS:
        return _CANDIDATE_MODELS
    blocked = (
        "embedding",
        "imagen",
        "veo",
        "tts",
        "audio",
        "image",
        "robotics",
        "computer-use",
        "aqa",
        "gemma",
        "learnlm",
    )
    flash_models = []
    pro_models = []
    try:
        for m in client.models.list():
            name = (getattr(m, "name", "") or "").replace("models/", "")
            lower = name.lower()
            actions = getattr(m, "supported_actions", None) or []
            if not name.startswith("gemini-"):
                continue
            if actions and "generateContent" not in actions:
                continue
            if any(b in lower for b in blocked):
                continue
            if name == MODEL_NAME:
                continue
            if "flash" in lower:
                flash_models.append(name)
            elif "pro" in lower:
                pro_models.append(name)
    except Exception:
        pass
    flash_models.sort(reverse=True)
    pro_models.sort(reverse=True)
    _CANDIDATE_MODELS = [MODEL_NAME] + flash_models[:4] + pro_models[:2]
    print(f"[MODELS] {_CANDIDATE_MODELS}")
    return _CANDIDATE_MODELS


def ask_json(client: genai.Client, contents: list, cache_path: Path) -> dict:
    if cache_path.is_file():
        print(f"[CACHE] {cache_path.name}")
        return json.loads(cache_path.read_text(encoding="utf-8"))

    candidates = list(get_candidate_models(client))
    max_attempts = 16
    idx = 0
    for attempt in range(1, max_attempts + 1):
        model = candidates[idx % len(candidates)]
        try:
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            )
            data = parse_json_text(response.text)
            cache_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"[OK] {cache_path.name} ({model})")
            time.sleep(8)
            return data
        except Exception as exc:
            full_err = str(exc)
            err_text = full_err.replace("\n", " ")[:140]
            is_not_found = ("404" in full_err) or ("NOT_FOUND" in full_err)
            is_per_minute = ("PerMinute" in full_err) or ("per minute" in full_err.lower())
            is_quota_dead = (("429" in full_err) or ("RESOURCE_EXHAUSTED" in full_err)) and not is_per_minute
            if (is_not_found or is_quota_dead) and len(candidates) > 1:
                candidates.remove(model)
                if model in _CANDIDATE_MODELS and len(_CANDIDATE_MODELS) > 1:
                    _CANDIDATE_MODELS.remove(model)
                reason = "het quota ngay" if is_quota_dead else "khong kha dung"
                print(f"[SKIP MODEL] {model} ({reason})")
                continue
            if attempt == max_attempts:
                raise
            idx += 1
            wait_sec = 5 if len(candidates) > 1 else min(60, 15 * attempt)
            if idx % len(candidates) == 0:
                wait_sec = min(60, 15 * ((attempt // len(candidates)) + 1))
            print(f"[RETRY {attempt}/{max_attempts}] {cache_path.name} [{model}] ({type(exc).__name__}: {err_text}), cho {wait_sec}s...")
            time.sleep(wait_sec)
    raise RuntimeError(f"Khong the xu ly {cache_path.name}")


def cut_audio(src: Path, dst: Path, start_sec: float, end_sec: float) -> None:
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    safe_start = max(0.0, float(start_sec) - 0.3)
    safe_end = max(safe_start + 1.0, float(end_sec) + 0.4)
    cmd = [
        ffmpeg_exe,
        "-y",
        "-i",
        str(src),
        "-ss",
        f"{safe_start:.2f}",
        "-to",
        f"{safe_end:.2f}",
        "-c:a",
        "libmp3lame",
        "-q:a",
        "4",
        str(dst),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def remove_watermark_from_image(
    client: genai.Client,
    img_path: Path,
    cache_path: Path,
    backup_dir: Path,
) -> None:
    if not img_path.is_file():
        return

    pil_img = Image.open(img_path).convert("RGB")
    prompt = (
        "Locate any overlaid watermark text, logo, or website banner stamped onto this TOEIC exam photo "
        "(such as center names, URLs, or slogans). "
        "Do NOT select signs, labels, or text that naturally belong inside the real photograph scene. "
        "Return JSON: {\"boxes\": [[ymin, xmin, ymax, xmax]]} with coordinates normalized from 0 to 1000. "
        "Return {\"boxes\": []} if there is no watermark."
    )
    res = ask_json(client, [pil_img, prompt], cache_path)
    raw_boxes = res if isinstance(res, list) else (res.get("boxes") or res.get("watermarks") or [])

    valid_boxes = []
    for item in raw_boxes:
        if isinstance(item, dict):
            item = item.get("box_2d") or item.get("bbox") or item.get("box") or item.get("coordinates")
        if isinstance(item, list) and len(item) == 4 and all(v is not None for v in item):
            valid_boxes.append([float(v) for v in item])

    if not valid_boxes:
        print(f"[WM] Sach san: {img_path.name}")
        return

    shutil.copy2(img_path, backup_dir / img_path.name)

    buf = np.fromfile(str(img_path), dtype=np.uint8)
    cv_img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if cv_img is None:
        return

    h, w = cv_img.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)
    applied = 0

    for box in valid_boxes:
        if max(box) <= 1.0:
            box = [v * 1000.0 for v in box]
        ymin, xmin, ymax, xmax = box
        y1 = max(0, int(min(ymin, ymax) / 1000.0 * h) - 4)
        x1 = max(0, int(min(xmin, xmax) / 1000.0 * w) - 4)
        y2 = min(h, int(max(ymin, ymax) / 1000.0 * h) + 4)
        x2 = min(w, int(max(xmin, xmax) / 1000.0 * w) + 4)
        if y2 <= y1 or x2 <= x1:
            continue
        if (y2 - y1) * (x2 - x1) > 0.35 * h * w:
            continue
        mask[y1:y2, x1:x2] = 255
        applied += 1

    if applied == 0:
        print(f"[WM] Bo qua vung khong hop le: {img_path.name}")
        return

    cleaned = cv2.inpaint(cv_img, mask, 5, cv2.INPAINT_TELEA)
    ext = img_path.suffix.lower() or ".png"
    ok, encoded = cv2.imencode(ext, cleaned)
    if ok:
        encoded.tofile(str(img_path))
        print(f"[WM] Da xoa watermark {img_path.name} ({applied} vung)")


def crop_part1_images(client: genai.Client, lc_pdf: Path, out_dir: Path, work_dir: Path) -> dict[int, str]:
    images_dir = out_dir / "images"
    pages_dir = work_dir / "part1_pages"
    images_dir.mkdir(parents=True, exist_ok=True)
    pages_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(lc_pdf)
    found: dict[int, str] = {}
    max_pages = min(8, len(doc))

    for page_idx in range(max_pages):
        if len(found) == 6:
            break
        page_img_path = pages_dir / f"page_{page_idx + 1}.png"
        if not page_img_path.is_file():
            pix = doc[page_idx].get_pixmap(matrix=fitz.Matrix(2, 2))
            pix.save(str(page_img_path))

        img = Image.open(page_img_path)
        prompt = (
            "Locate TOEIC Part 1 test photographs numbered 1 through 6 on this page. "
            "Ignore any sample or example photograph. "
            "Return JSON: {\"photos\": [{\"questionNumber\": 1, \"box_2d\": [ymin, xmin, ymax, xmax]}]} "
            "with coordinates normalized from 0 to 1000. Return an empty list if none found."
        )
        res = ask_json(client, [img, prompt], work_dir / f"p1_boxes_page_{page_idx + 1}.json")
        w, h = img.size

        items = res if isinstance(res, list) else (res.get("photos") or res.get("images") or res.get("items") or [])
        for item in items:
            if not isinstance(item, dict):
                continue
            q_raw = item.get("questionNumber") or item.get("question_number") or item.get("number") or item.get("question")
            if q_raw is None:
                continue
            q_num = int(q_raw)
            if q_num < 1 or q_num > 6 or q_num in found:
                continue
            box = item.get("box_2d") or item.get("bbox") or item.get("box") or item.get("bounding_box") or item.get("coordinates")
            if isinstance(box, dict):
                box = [box.get("ymin"), box.get("xmin"), box.get("ymax"), box.get("xmax")]
            if not box and all(k in item for k in ("ymin", "xmin", "ymax", "xmax")):
                box = [item["ymin"], item["xmin"], item["ymax"], item["xmax"]]
            if not isinstance(box, list) or len(box) != 4 or any(v is None for v in box):
                print(f"[WARN] Thieu toa do Q{q_num} trang {page_idx + 1}: {item}")
                continue
            ymin, xmin, ymax, xmax = [float(v) for v in box]
            crop_box = (
                max(0, int(xmin / 1000 * w)),
                max(0, int(ymin / 1000 * h)),
                min(w, int(xmax / 1000 * w)),
                min(h, int(ymax / 1000 * h)),
            )
            rel_path = f"images/p1_{q_num:02d}.png"
            img.crop(crop_box).save(out_dir / rel_path)
            found[q_num] = rel_path
            print(f"[IMG] Cut Part 1 Q{q_num} -> {rel_path}")

    doc.close()
    raw_dir_p1 = work_dir / "part1_raw"
    raw_dir_p1.mkdir(parents=True, exist_ok=True)
    for q_num, rel_path in sorted(found.items()):
        remove_watermark_from_image(
            client,
            out_dir / rel_path,
            work_dir / f"p1_wm_{q_num:02d}.json",
            raw_dir_p1,
        )
    return found


def extract_answers(client: genai.Client, ans_lc: Path, ans_rc: Path, test_num: int, work_dir: Path) -> dict[int, str]:
    lc_cache = work_dir / "answers_lc.json"
    rc_cache = work_dir / "answers_rc.json"
    if lc_cache.is_file() and rc_cache.is_file():
        print("[CACHE] answers_lc.json & answers_rc.json")
        lc_data = json.loads(lc_cache.read_text(encoding="utf-8"))
        rc_data = json.loads(rc_cache.read_text(encoding="utf-8"))
    else:
        lc_file = upload_and_wait(client, ans_lc)
        rc_file = upload_and_wait(client, ans_rc)
        try:
            lc_data = ask_json(
                client,
                [
                    lc_file,
                    f"Extract all 100 Listening answer keys (questions 1 to 100) for TEST {test_num} ONLY. "
                    "Return JSON: {\"answers\": {\"1\": \"A\", \"2\": \"B\", ...}}.",
                ],
                lc_cache,
            )
            rc_data = ask_json(
                client,
                [
                    rc_file,
                    f"Extract all 100 Reading answer keys (questions 101 to 200) for TEST {test_num} ONLY. "
                    "Return JSON: {\"answers\": {\"101\": \"A\", \"102\": \"C\", ...}}.",
                ],
                rc_cache,
            )
        finally:
            client.files.delete(name=lc_file.name)
            client.files.delete(name=rc_file.name)

    merged: dict[int, str] = {}
    for bucket in (lc_data.get("answers", {}), rc_data.get("answers", {})):
        for k, v in bucket.items():
            ans = str(v).strip().upper()[:1]
            if ans in ("A", "B", "C", "D"):
                merged[int(k)] = ans
    print(f"[ANS] Extracted {len(merged)}/200 answer keys")
    return merged


def process_audio_part(
    client: genai.Client,
    mp3_path: Path,
    part_num: int,
    instruction: str,
    out_dir: Path,
    work_dir: Path,
) -> list[dict]:
    audio_dir = out_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    cache_file = work_dir / f"audio_part{part_num}.json"

    if cache_file.is_file():
        data = json.loads(cache_file.read_text(encoding="utf-8"))
    else:
        uploaded = upload_and_wait(client, mp3_path)
        try:
            data = ask_json(client, [uploaded, instruction], cache_file)
        finally:
            client.files.delete(name=uploaded.name)

    segments = sorted(extract_items(data, "segments"), key=lambda s: int(s["firstQuestion"]))
    for idx, seg in enumerate(segments, start=1):
        first_q = int(seg["firstQuestion"])
        if part_num in (1, 2):
            rel_path = f"audio/p{part_num}_{first_q:02d}.mp3"
        else:
            rel_path = f"audio/p{part_num}_g{idx:02d}.mp3"

        dst = out_dir / rel_path
        if not dst.is_file():
            cut_audio(mp3_path, dst, seg["startSec"], seg["endSec"])
        seg["audioUrl"] = rel_path

    print(f"[AUDIO] Part {part_num}: sliced {len(segments)} clips")
    return segments


def extract_items(data, key):
    if isinstance(data, dict):
        return data.get(key, [])
    if isinstance(data, list):
        if len(data) == 1 and isinstance(data[0], dict) and key in data[0]:
            return data[0][key]
        return data
    return []


def build_exam(raw_dir: Path, out_dir: Path, test_num: int, title: str) -> None:
    if not os.environ.get("GEMINI_API_KEY"):
        raise RuntimeError("Thieu bien moi truong GEMINI_API_KEY.")

    required = ["lc.pdf", "rc.pdf", "ans_lc.pdf", "ans_rc.pdf", "part1.mp3", "part2.mp3", "part3.mp3", "part4.mp3"]
    for fname in required:
        if not (raw_dir / fname).is_file():
            raise FileNotFoundError(f"Khong tim thay file: {raw_dir / fname}")

    work_dir = out_dir / "work"
    work_dir.mkdir(parents=True, exist_ok=True)
    client = genai.Client()

    answers = extract_answers(client, raw_dir / "ans_lc.pdf", raw_dir / "ans_rc.pdf", test_num, work_dir)
    p1_images = crop_part1_images(client, raw_dir / "lc.pdf", out_dir, work_dir)

    p1_audio = process_audio_part(
        client,
        raw_dir / "part1.mp3",
        1,
        "Transcribe TOEIC Part 1 (questions 1 to 6) and return exact startSec and endSec in seconds for each question clip. "
        "Return JSON: {\"segments\": [{\"firstQuestion\": 1, \"lastQuestion\": 1, \"startSec\": 0.0, \"endSec\": 15.0, "
        "\"transcriptHtml\": \"<p>(A) ...<br/>(B) ...<br/>(C) ...<br/>(D) ...</p>\"}]}.",
        out_dir,
        work_dir,
    )
    p2_audio = process_audio_part(
        client,
        raw_dir / "part2.mp3",
        2,
        "Transcribe TOEIC Part 2 (questions 7 to 31, total 25 items) with exact startSec and endSec in seconds for each question. "
        "Return JSON: {\"segments\": [{\"firstQuestion\": 7, \"lastQuestion\": 7, \"startSec\": 0.0, \"endSec\": 12.0, "
        "\"transcriptHtml\": \"<p><strong>Q:</strong> ...<br/>(A) ...<br/>(B) ...<br/>(C) ...</p>\"}]}.",
        out_dir,
        work_dir,
    )
    p3_audio = process_audio_part(
        client,
        raw_dir / "part3.mp3",
        3,
        "Transcribe TOEIC Part 3 (13 conversations covering questions 32-34, 35-37, ..., 68-70) with exact startSec and endSec "
        "in seconds for each 3-question conversation block. "
        "Return JSON: {\"segments\": [{\"firstQuestion\": 32, \"lastQuestion\": 34, \"startSec\": 0.0, \"endSec\": 45.0, "
        "\"transcriptHtml\": \"<p>...</p>\"}]}.",
        out_dir,
        work_dir,
    )
    p4_audio = process_audio_part(
        client,
        raw_dir / "part4.mp3",
        4,
        "Transcribe TOEIC Part 4 (10 short talks covering questions 71-73, 74-76, ..., 98-100) with exact startSec and endSec "
        "in seconds for each 3-question talk block. "
        "Return JSON: {\"segments\": [{\"firstQuestion\": 71, \"lastQuestion\": 73, \"startSec\": 0.0, \"endSec\": 45.0, "
        "\"transcriptHtml\": \"<p>...</p>\"}]}.",
        out_dir,
        work_dir,
    )

    lc_need = not ((work_dir / "pdf_part3.json").is_file() and (work_dir / "pdf_part4.json").is_file())
    lc_uploaded = upload_and_wait(client, raw_dir / "lc.pdf") if lc_need else None
    try:
        p3_pdf = ask_json(
            client,
            [
                lc_uploaded,
                "Extract ALL TOEIC Part 3 questions (questions 32 to 70, grouped into 13 groups of 3 questions each) from this PDF. "
                "If a group includes a graphic, table, schedule, map, or form, recreate it as clean HTML in passageHtml (else null). "
                "Return JSON: {\"groups\": [{\"orderIndex\": 1, \"passageHtml\": null, \"questions\": ["
                "{\"questionNumber\": 32, \"content\": \"...\", \"optionA\": \"...\", \"optionB\": \"...\", \"optionC\": \"...\", \"optionD\": \"...\"}"
                "]}]}.",
            ],
            work_dir / "pdf_part3.json",
        )
        p4_pdf = ask_json(
            client,
            [
                lc_uploaded,
                "Extract ALL TOEIC Part 4 questions (questions 71 to 100, grouped into 10 groups of 3 questions each) from this PDF. "
                "If a group includes a graphic, table, schedule, coupon, or chart, recreate it as clean HTML in passageHtml (else null). "
                "Return JSON: {\"groups\": [{\"orderIndex\": 1, \"passageHtml\": null, \"questions\": ["
                "{\"questionNumber\": 71, \"content\": \"...\", \"optionA\": \"...\", \"optionB\": \"...\", \"optionC\": \"...\", \"optionD\": \"...\"}"
                "]}]}.",
            ],
            work_dir / "pdf_part4.json",
        )
    finally:
        if lc_uploaded:
            client.files.delete(name=lc_uploaded.name)

    rc_need = not all((work_dir / f).is_file() for f in ("pdf_part5.json", "pdf_part6.json", "pdf_part7a.json", "pdf_part7b.json"))
    rc_uploaded = upload_and_wait(client, raw_dir / "rc.pdf") if rc_need else None
    try:
        p5_pdf = ask_json(
            client,
            [
                rc_uploaded,
                "Extract ALL 30 TOEIC Part 5 questions (questions 101 to 130) verbatim from this PDF. "
                "Return JSON: {\"questions\": [{\"questionNumber\": 101, \"content\": \"...\", "
                "\"optionA\": \"...\", \"optionB\": \"...\", \"optionC\": \"...\", \"optionD\": \"...\"}]}.",
            ],
            work_dir / "pdf_part5.json",
        )
        p6_pdf = ask_json(
            client,
            [
                rc_uploaded,
                "Extract ALL 4 TOEIC Part 6 passages and their 16 questions (131-134, 135-138, 139-142, 143-146) verbatim from this PDF. "
                "Format each passage cleanly in passageHtml marking blanks like <strong>[131]</strong>. "
                "Return JSON: {\"groups\": [{\"orderIndex\": 1, \"passageHtml\": \"<p>...</p>\", \"questions\": ["
                "{\"questionNumber\": 131, \"content\": \"Select the best option for blank [131].\", "
                "\"optionA\": \"...\", \"optionB\": \"...\", \"optionC\": \"...\", \"optionD\": \"...\"}]}]}.",
            ],
            work_dir / "pdf_part6.json",
        )
        p7a_pdf = ask_json(
            client,
            [
                rc_uploaded,
                "Extract ALL TOEIC Part 7 single-passage groups covering questions 147 through 175 verbatim from this PDF. "
                "Format each email, notice, article, table, or chat thread cleanly in passageHtml. "
                "Return JSON: {\"groups\": [{\"orderIndex\": 1, \"passageHtml\": \"<div>...</div>\", \"questions\": ["
                "{\"questionNumber\": 147, \"content\": \"...\", \"optionA\": \"...\", \"optionB\": \"...\", \"optionC\": \"...\", \"optionD\": \"...\"}]}]}.",
            ],
            work_dir / "pdf_part7a.json",
        )
        p7b_pdf = ask_json(
            client,
            [
                rc_uploaded,
                "Extract ALL TOEIC Part 7 double-passage and triple-passage groups covering questions 176 through 200 verbatim from this PDF. "
                "Combine all linked documents of each group cleanly inside passageHtml with clear borders/headings. "
                "Return JSON: {\"groups\": [{\"orderIndex\": 11, \"passageHtml\": \"<div>...</div>\", \"questions\": ["
                "{\"questionNumber\": 176, \"content\": \"...\", \"optionA\": \"...\", \"optionB\": \"...\", \"optionC\": \"...\", \"optionD\": \"...\"}]}]}.",
            ],
            work_dir / "pdf_part7b.json",
        )
    finally:
        if rc_uploaded:
            client.files.delete(name=rc_uploaded.name)

    question_groups = []

    p1_audio_map = {int(s["firstQuestion"]): s for s in p1_audio}
    for q_num in range(1, 7):
        seg = p1_audio_map.get(q_num, {})
        question_groups.append(
            {
                "partNumber": 1,
                "orderIndex": q_num,
                "audioUrl": seg.get("audioUrl"),
                "imageUrl": p1_images.get(q_num),
                "transcriptHtml": seg.get("transcriptHtml"),
                "questions": [
                    {
                        "questionNumber": q_num,
                        "content": "Look at the picture and choose the statement that best describes it.",
                        "optionA": "A",
                        "optionB": "B",
                        "optionC": "C",
                        "optionD": "D",
                        "correctOption": answers.get(q_num, "A"),
                        "explanation": None,
                        "difficultyLevel": 2,
                        "tagNames": ["Part 1 - Mô tả tranh người & vật"],
                    }
                ],
            }
        )

    p2_audio_map = {int(s["firstQuestion"]): s for s in p2_audio}
    for idx, q_num in enumerate(range(7, 32), start=1):
        seg = p2_audio_map.get(q_num, {})
        question_groups.append(
            {
                "partNumber": 2,
                "orderIndex": idx,
                "audioUrl": seg.get("audioUrl"),
                "transcriptHtml": seg.get("transcriptHtml"),
                "questions": [
                    {
                        "questionNumber": q_num,
                        "content": "Listen to the question and choose the best response.",
                        "optionA": "A",
                        "optionB": "B",
                        "optionC": "C",
                        "optionD": None,
                        "correctOption": answers.get(q_num, "A"),
                        "explanation": None,
                        "difficultyLevel": 3,
                        "tagNames": ["Part 2 - Câu hỏi Wh- & Yes/No"],
                    }
                ],
            }
        )

    def attach_listening_groups(part_num: int, pdf_groups: list[dict], audio_segs: list[dict]):
        seg_by_first = {int(s["firstQuestion"]): s for s in audio_segs}
        for idx, g in enumerate(pdf_groups, start=1):
            qs = sorted(g.get("questions", []), key=lambda x: int(x["questionNumber"]))
            first_q = int(qs[0]["questionNumber"]) if qs else -1
            seg = seg_by_first.get(first_q) or (audio_segs[idx - 1] if idx - 1 < len(audio_segs) else {})
            question_groups.append(
                {
                    "partNumber": part_num,
                    "orderIndex": idx,
                    "audioUrl": seg.get("audioUrl"),
                    "passageHtml": g.get("passageHtml"),
                    "transcriptHtml": seg.get("transcriptHtml"),
                    "questions": [
                        {
                            "questionNumber": int(q["questionNumber"]),
                            "content": q.get("content"),
                            "optionA": q.get("optionA"),
                            "optionB": q.get("optionB"),
                            "optionC": q.get("optionC"),
                            "optionD": q.get("optionD"),
                            "correctOption": answers.get(int(q["questionNumber"]), "A"),
                            "explanation": None,
                            "difficultyLevel": 3,
                            "tagNames": ["Part 3 & 4 - Nghe ý chính & Suy luận"],
                        }
                        for q in qs
                    ],
                }
            )

    attach_listening_groups(3, extract_items(p3_pdf, "groups"), p3_audio)
    attach_listening_groups(4, extract_items(p4_pdf, "groups"), p4_audio)

    p5_questions = sorted(extract_items(p5_pdf, "questions"), key=lambda x: int(x["questionNumber"]))
    question_groups.append(
        {
            "partNumber": 5,
            "orderIndex": 1,
            "questions": [
                {
                    "questionNumber": int(q["questionNumber"]),
                    "content": q.get("content"),
                    "optionA": q.get("optionA"),
                    "optionB": q.get("optionB"),
                    "optionC": q.get("optionC"),
                    "optionD": q.get("optionD"),
                    "correctOption": answers.get(int(q["questionNumber"]), "A"),
                    "explanation": None,
                    "difficultyLevel": 3,
                    "tagNames": ["Part 5 - Từ loại (Word Forms)"],
                }
                for q in p5_questions
            ],
        }
    )

    for idx, g in enumerate(extract_items(p6_pdf, "groups"), start=1):
        qs = sorted(g.get("questions", []), key=lambda x: int(x["questionNumber"]))
        question_groups.append(
            {
                "partNumber": 6,
                "orderIndex": idx,
                "passageHtml": g.get("passageHtml"),
                "questions": [
                    {
                        "questionNumber": int(q["questionNumber"]),
                        "content": q.get("content"),
                        "optionA": q.get("optionA"),
                        "optionB": q.get("optionB"),
                        "optionC": q.get("optionC"),
                        "optionD": q.get("optionD"),
                        "correctOption": answers.get(int(q["questionNumber"]), "A"),
                        "explanation": None,
                        "difficultyLevel": 3,
                        "tagNames": ["Part 6 - Điền câu vào đoạn văn"],
                    }
                    for q in qs
                ],
            }
        )

    all_p7 = extract_items(p7a_pdf, "groups") + extract_items(p7b_pdf, "groups")
    for idx, g in enumerate(all_p7, start=1):
        qs = sorted(g.get("questions", []), key=lambda x: int(x["questionNumber"]))
        question_groups.append(
            {
                "partNumber": 7,
                "orderIndex": idx,
                "passageHtml": g.get("passageHtml"),
                "questions": [
                    {
                        "questionNumber": int(q["questionNumber"]),
                        "content": q.get("content"),
                        "optionA": q.get("optionA"),
                        "optionB": q.get("optionB"),
                        "optionC": q.get("optionC"),
                        "optionD": q.get("optionD"),
                        "correctOption": answers.get(int(q["questionNumber"]), "A"),
                        "explanation": None,
                        "difficultyLevel": 3,
                        "tagNames": ["Part 7 - Tìm thông tin chi tiết"],
                    }
                    for q in qs
                ],
            }
        )

    exam_json = {
        "title": title,
        "year": 2024,
        "source": "ETS 2024",
        "durationMinutes": 120,
        "publishImmediately": True,
        "questionGroups": question_groups,
    }

    exam_path = out_dir / "exam.json"
    exam_path.write_text(json.dumps(exam_json, ensure_ascii=False, indent=2), encoding="utf-8")
    total_q = sum(len(g["questions"]) for g in question_groups)
    print(f"[DONE] Xuat {exam_path} ({total_q} cau hoi)")


def main() -> None:
    if len(sys.argv) < 4:
        print("Cach dung: python build_ets_package.py <thu_muc_raw> <thu_muc_dich> <so_test> [tieu_de]")
        sys.exit(1)

    raw_dir = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    test_num = int(sys.argv[3])
    title = sys.argv[4] if len(sys.argv) >= 5 else f"ETS TOEIC 2024 - Test {test_num:02d}"
    build_exam(raw_dir, out_dir, test_num, title)


if __name__ == "__main__":
    main()



