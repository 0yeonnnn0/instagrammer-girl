FROM node:20-bookworm-slim

# System deps: Chromium for Puppeteer, FFmpeg for reel assembly, CJK fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy package files and install
COPY package.json package-lock.json ./
RUN npm ci --production

# Copy application
COPY . .

# Ensure data and output dirs exist
RUN mkdir -p data output logs workspace

# Volumes for persistent data
VOLUME ["/app/data", "/app/output"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3000/login || exit 1

CMD ["node", "server.js"]
