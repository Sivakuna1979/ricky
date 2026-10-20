# Render worker image (Railway, Render, Fly, Cloud Run…). The API itself deploys to Vercel.
FROM node:22-bookworm-slim

# ffmpeg for video; Noto fonts so captions in Tamil, Hindi, Arabic, Chinese… render correctly.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg fontconfig fonts-noto-core fonts-noto-cjk ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .

ENV NODE_ENV=production
CMD ["npx", "tsx", "worker/index.ts"]
