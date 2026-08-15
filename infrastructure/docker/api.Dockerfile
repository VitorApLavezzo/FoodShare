FROM node:20-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --workspace=@foodshare/api --include-workspace-root

FROM deps AS build
COPY apps/api apps/api
RUN npm run --workspace=@foodshare/api prisma:generate
RUN npm run --workspace=@foodshare/api build
WORKDIR /repo/apps/api
RUN npx tsc prisma/seed.ts --outDir dist/prisma --module commonjs --target es2021 --esModuleInterop --skipLibCheck --resolveJsonModule
WORKDIR /repo

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/apps/api/node_modules /repo/apps/api/node_modules
COPY --from=build /repo/apps/api/dist /repo/apps/api/dist
COPY --from=build /repo/apps/api/prisma /repo/apps/api/prisma
COPY --from=build /repo/apps/api/package.json /repo/apps/api/package.json

WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/prisma/seed.js && node dist/src/main"]
