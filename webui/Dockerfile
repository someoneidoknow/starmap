FROM oven/bun:1 AS build

WORKDIR /app

COPY bun.lock package.json svelte.config.js tsconfig.json vite.config.ts eslint.config.js ./
RUN bun install

COPY . .
RUN bun run build


FROM node:24-alpine AS runtime

WORKDIR /app

COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
RUN apk add --no-cache font-dejavu

EXPOSE 3000

CMD ["node", "build"]
