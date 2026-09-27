FROM node:22-bookworm-slim

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.26.0 --activate
RUN npm install -g tsx@4.20.6

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/config packages/config
COPY packages/database packages/database
COPY packages/domain packages/domain

RUN pnpm install --frozen-lockfile --filter @rovo/api... --filter @rovo/database...

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["tsx", "apps/api/src/server.ts"]
