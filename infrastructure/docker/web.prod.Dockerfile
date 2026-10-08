# Build de produção do front: gera os arquivos estáticos e serve com nginx.
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
RUN npm install --workspace=@foodshare/web --include-workspace-root
COPY packages/types packages/types
COPY apps/web apps/web
# O Vite embute a URL da API no bundle em tempo de build.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace=@foodshare/web

FROM nginx:1.27-alpine
COPY infrastructure/nginx/web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
