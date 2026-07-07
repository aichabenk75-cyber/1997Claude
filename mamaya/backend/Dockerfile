# Mamaya API — image de production (multi-stage, non-root)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# Utilisateur non privilégié — jamais root en prod
RUN addgroup -S mamaya && adduser -S mamaya -G mamaya
COPY --from=build --chown=mamaya:mamaya /app/node_modules ./node_modules
COPY --from=build --chown=mamaya:mamaya /app/dist ./dist
COPY --chown=mamaya:mamaya migrations ./migrations
USER mamaya
EXPOSE 3000
CMD ["node", "dist/main.js"]
