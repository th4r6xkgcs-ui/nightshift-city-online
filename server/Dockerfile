# Nightshift City Online game server — container recipe.
# Build from the REPO ROOT (it needs shared/ and, once merged, city-data.js):
#   docker build -f server/Dockerfile -t nightshift-server .
#   docker run -p 8080:8080 -v nsco-data:/data nightshift-server
# No npm install step: the server has zero dependencies.
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    PROFILES=/data/profiles.json

WORKDIR /app
# Only what the server needs (see Dockerfile.dockerignore).
COPY . .

# Player profiles live on a mounted volume so they survive redeploys.
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1
CMD ["node", "server/index.js"]
