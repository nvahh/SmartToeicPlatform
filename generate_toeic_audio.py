import asyncio
import os
import edge_tts

AUDIO_DIR = r"D:\SmartToeicPlatform\backend\src\SmartToeic.API\wwwroot\uploads\audio"
os.makedirs(AUDIO_DIR, exist_ok=True)

# Danh sách câu cần tạo âm thanh (có thể phối giọng Mỹ, Anh, Úc như đề ETS)
AUDIO_TASKS = [
    {
        "filename": "sample-p1.mp3",
        "voice": "en-US-AvaNeural",
        "text": (
            "Number one. Look at the picture marked number one in your test book. "
            "A. The woman is typing on a laptop. "
            "B. The woman is holding a phone. "
            "C. The woman is watering plants. "
            "D. The woman is leaving the room."
        ),
    },
    {
        "filename": "sample-p2.mp3",
        "voice": "en-GB-RyanNeural",
        "text": (
            "Number seven. Where will the quarterly review be held? "
            "A. In conference room B. "
            "B. Next Tuesday morning. "
            "C. Yes, I reviewed it."
        ),
    },
]

async def main():
    for task in AUDIO_TASKS:
        out_path = os.path.join(AUDIO_DIR, task["filename"])
        communicate = edge_tts.Communicate(task["text"], task["voice"], rate="-8%")
        await communicate.save(out_path)
        print(f"Da tao xong: {out_path}")

if __name__ == "__main__":
    asyncio.run(main())
