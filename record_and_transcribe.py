import whisper, os, time
from datetime import datetime
import sounddevice as sd
import soundfile as sf

MODEL = whisper.load_model("base")
OUT_DIR = "./output-transcripts"
os.makedirs(OUT_DIR, exist_ok=True)

def record_chunk(filename="temp.wav", duration=60):
    print(f"Recording {duration}s...")
    fs = 16000
    audio = sd.rec(int(duration * fs), samplerate=fs, channels=1)
    sd.wait()
    sf.write(filename, audio, fs)

def transcribe_to_file(wav_path):
    result = MODEL.transcribe(wav_path)
    ts = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    out_path = f"{OUT_DIR}/voice_{ts}.txt"
    with open(out_path, "w") as f:
        f.write(result['text'])
    print(f"Saved transcript to {out_path}")

while True:
    record_chunk()
    transcribe_to_file("temp.wav")
    time.sleep(2)
