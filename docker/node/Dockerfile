FROM node:22-alpine AS base

WORKDIR /usr/src/app

RUN apk add --no-cache python3 make g++ libc6-compat

COPY package*.json ./

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

RUN npm install

RUN npm ci --ignore-scripts \
    && npm rebuild bcrypt --build-from-source \
    && npm run prepare --if-present

COPY . .

USER node

EXPOSE 3000

CMD ["node", "server.js"]