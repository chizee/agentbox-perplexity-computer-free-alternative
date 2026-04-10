FROM node:20-alpine

RUN apk add --no-cache \
    bash coreutils curl wget git \
    python3 py3-pip \
    procps htop \
    && adduser -D -s /bin/bash sandbox

WORKDIR /home/sandbox/app

COPY package.json .
RUN npm install --production

COPY server.js .

RUN chown -R sandbox:sandbox /home/sandbox

EXPOSE 8080

CMD ["node", "server.js"]
