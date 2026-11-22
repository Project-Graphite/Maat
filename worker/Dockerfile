FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache docker-cli

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY sandbox-images ./sandbox-images

USER node
CMD ["node", "src/server.js"]
