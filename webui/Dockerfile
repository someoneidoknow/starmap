FROM oven/bun:1 AS build

WORKDIR /app

COPY bun.lock package.json svelte.config.js tsconfig.json vite.config.ts eslint.config.js ./
RUN bun install

COPY . .
RUN bun run build


FROM node:24-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache fontconfig
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY ./font/SourceSans3-Regular.ttf /usr/share/fonts/SourceSans3-Regular.ttf
RUN fc-cache -f

EXPOSE 3000

CMD ["node", "build"]
