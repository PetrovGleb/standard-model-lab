FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./
COPY libs ./libs
COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile --filter '!@standard-model/desktop'
RUN pnpm build:web
CMD ["pnpm", "start:api"]
