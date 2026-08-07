FROM node:20-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

EXPOSE 3333
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
