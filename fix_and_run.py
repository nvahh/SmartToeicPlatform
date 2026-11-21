import asyncio
import json
import os
import edge_tts
from generate_full_7part_assets import AUDIO_DIR, AUDIO_SCRIPTS, EXAM_PAYLOAD, JSON_OUT

VOICE_MAP = {
    "en-US-AndrewNeural": "en-US-GuyNeural",
}

FALLBACK_VOICES = [
    "en-AU-WilliamNeural",
    "en-US-AvaNeural",
    "en-GB-RyanNeural",
]


async def synthesize_segment(voice: str, text: str) -> bytes:
    mapped = VOICE_MAP.get(voice, voice)
    candidates = [mapped] + [v for v in FALLBACK_VOICES if v != mapped]
    last_error = None
    for candidate in candidates:
        try:
            chunks = bytearray()
            comm = edge_tts.Communicate(text, candidate, rate="-6%")
            async for msg in comm.stream():
                if msg["type"] == "audio":
                    chunks.extend(msg["data"])
            if chunks:
                return bytes(chunks)
        except Exception as exc:
            last_error = exc
            await asyncio.sleep(0.5)
    raise last_error or RuntimeError(f"Failed audio: {text[:30]}")


async def main():
    os.makedirs(AUDIO_DIR, exist_ok=True)
    with open(JSON_OUT, "w", encoding="utf-8") as f:
        json.dump(EXAM_PAYLOAD, f, ensure_ascii=False, indent=2)
    print(f"[OK] JSON de 7 Part: {JSON_OUT}")

    for filename, segments in AUDIO_SCRIPTS.items():
        out_path = os.path.join(AUDIO_DIR, filename)
        if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
            print(f"[SKIP] Da co san: {filename}")
            continue

        merged = bytearray()
        for voice, text in segments:
            merged.extend(await synthesize_segment(voice, text))
            await asyncio.sleep(0.4)

        with open(out_path, "wb") as f:
            f.write(merged)
        print(f"[OK] Audio: {out_path}")


if __name__ == "__main__":
    asyncio.run(main())
