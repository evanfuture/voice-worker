FROM python:3.11-slim

# Install system dependencies for audio recording
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    libasound2-dev \
    portaudio19-dev \
    python3-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
RUN pip install git+https://github.com/openai/whisper.git sounddevice soundfile

WORKDIR /app
COPY record_and_transcribe.py /app/

# Create output directory
RUN mkdir -p /app/output-transcripts

CMD ["python", "record_and_transcribe.py"]
