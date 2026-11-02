# Two ways to run the frontend, picked with the build target:
#   dev  (default, used by docker-compose.yml): the Vite dev server with hot
#        reload — for working on the code.
#   prod (docker-compose.prod.yml, the VM): a minified production build
#        served by nginx — a handful of files instead of one per source file.
# Both listen on 5173, so whatever proxies to the frontend doesn't change.

FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

# VITE_* values are baked into the bundle at build time, so they're build
# args here, not runtime environment: change them in .env, then rebuild.
FROM deps AS build
ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_ORCID_CLIENT_ID
ARG VITE_ORCID_REDIRECT_URI
ENV VITE_API_URL=$VITE_API_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_ORCID_CLIENT_ID=$VITE_ORCID_CLIENT_ID \
    VITE_ORCID_REDIRECT_URI=$VITE_ORCID_REDIRECT_URI
COPY . .
# Without it, the build would point the app (and its security policy) at
# localhost:4000, and every API call would fail on the server.
RUN test -n "$VITE_API_URL" || (echo "VITE_API_URL must be set in .env for the production build" >&2 && exit 1)
RUN npm run build

FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 5173

# Last, so a plain `docker build` without --target still gives the dev server.
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
