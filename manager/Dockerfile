FROM node:20-slim

WORKDIR /app

COPY package.json .
RUN npm install --production

COPY server.js .
COPY mcp-server.js .
COPY start.sh .
RUN chmod +x start.sh

EXPOSE 4000 4001

CMD ["./start.sh"]
