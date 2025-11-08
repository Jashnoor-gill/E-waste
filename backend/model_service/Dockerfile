FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install minimal system deps for Pillow and other compiled wheels
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential libjpeg-dev libsndfile1 git curl \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./

RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Install PyTorch CPU wheels (explicit index for CPU build)
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.6.0+cpu torchvision==0.21.0+cpu

COPY . /app

EXPOSE 8001

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
