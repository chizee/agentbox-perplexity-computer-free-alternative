FROM node:20-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:99

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    xvfb \
    x11vnc \
    novnc \
    websockify \
    fluxbox \
    procps \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN useradd -m -s /bin/bash sandbox
WORKDIR /home/sandbox/app

COPY package.json .
RUN npm install --production

COPY server.js .
COPY start.sh .
RUN chmod +x start.sh

RUN chown -R sandbox:sandbox /home/sandbox

EXPOSE 6080 8080

CMD ["./start.sh"]
