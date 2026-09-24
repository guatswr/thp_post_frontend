ARG DOCKER_REGISTRY=docker.io
FROM ${DOCKER_REGISTRY}/library/node:24.15.0-alpine AS build
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY . ./
RUN npm run build
FROM ${DOCKER_REGISTRY}/library/caddy:2.10.2-alpine
COPY --from=build /src/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
