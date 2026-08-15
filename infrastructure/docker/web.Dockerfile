FROM node:20-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install --workspace=@foodshare/web --include-workspace-root

FROM deps AS dev
COPY apps/web apps/web
WORKDIR /repo/apps/web
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
