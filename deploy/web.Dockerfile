FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.26.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web apps/web
COPY packages/config/pons-pair-tokens.json packages/config/pons-pair-tokens.json

ARG NEXT_PUBLIC_ROVO_API_URL
ARG NEXT_PUBLIC_PRIVY_APP_ID
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ARG NEXT_PUBLIC_ROBINHOOD_RPC_URL
ARG NEXT_PUBLIC_ROVO_REGISTRY_ADDRESS
ARG NEXT_PUBLIC_ROVO_FACTORY_WRAPPER_ADDRESS
ARG NEXT_PUBLIC_ROVO_ZAP_ROUTER_ADDRESS
ARG NEXT_PUBLIC_ROVO_SPLITTER_ADDRESS
ARG NEXT_PUBLIC_ROVO_NOTTINGHAM_ADDRESS
ARG NEXT_PUBLIC_ROVO_HOLDER_REWARDS_ADDRESS

ENV NEXT_PUBLIC_ROVO_API_URL=$NEXT_PUBLIC_ROVO_API_URL
ENV NEXT_PUBLIC_PRIVY_APP_ID=$NEXT_PUBLIC_PRIVY_APP_ID
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ENV NEXT_PUBLIC_ROBINHOOD_RPC_URL=$NEXT_PUBLIC_ROBINHOOD_RPC_URL
ENV NEXT_PUBLIC_ROVO_REGISTRY_ADDRESS=$NEXT_PUBLIC_ROVO_REGISTRY_ADDRESS
ENV NEXT_PUBLIC_ROVO_FACTORY_WRAPPER_ADDRESS=$NEXT_PUBLIC_ROVO_FACTORY_WRAPPER_ADDRESS
ENV NEXT_PUBLIC_ROVO_ZAP_ROUTER_ADDRESS=$NEXT_PUBLIC_ROVO_ZAP_ROUTER_ADDRESS
ENV NEXT_PUBLIC_ROVO_SPLITTER_ADDRESS=$NEXT_PUBLIC_ROVO_SPLITTER_ADDRESS
ENV NEXT_PUBLIC_ROVO_NOTTINGHAM_ADDRESS=$NEXT_PUBLIC_ROVO_NOTTINGHAM_ADDRESS
ENV NEXT_PUBLIC_ROVO_HOLDER_REWARDS_ADDRESS=$NEXT_PUBLIC_ROVO_HOLDER_REWARDS_ADDRESS

RUN pnpm install --frozen-lockfile --filter @rovo/web...
RUN node -e 'const url=process.env.NEXT_PUBLIC_ROVO_API_URL; if(!url) throw new Error("NEXT_PUBLIC_ROVO_API_URL is empty"); console.log("API_URL="+url)' \
 && pnpm --filter @rovo/web build \
 && node -e 'const {execSync}=require("child_process"); const url=process.env.NEXT_PUBLIC_ROVO_API_URL; const hits=execSync("grep -R -l -- "+JSON.stringify(url)+" apps/web/.next/static || true",{encoding:"utf8"}); if(!hits.trim()){console.error("bundle missing "+url); process.exit(1)} console.log("bundle contains "+url)'

FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

EXPOSE 8080
CMD ["node", "apps/web/server.js"]
