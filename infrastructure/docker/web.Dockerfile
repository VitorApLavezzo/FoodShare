FROM node:20-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
# O package.json do pacote compartilhado precisa existir já no install: é ele
# que faz o npm criar o link em node_modules/@foodshare/types.
COPY packages/types/package.json packages/types/package.json
RUN npm install --workspace=@foodshare/web --include-workspace-root

FROM deps AS dev
# Sem o código do pacote, o link criado acima fica apontando para o vazio e o
# Vite falha ao resolver "@foodshare/types".
COPY packages/types packages/types
COPY apps/web apps/web
WORKDIR /repo/apps/web
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
