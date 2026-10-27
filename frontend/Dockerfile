FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Where the site lives and how to reach its operator. Baked into canonical links, robots.txt and the legal pages
ARG VITE_SITE_URL
ARG VITE_CONTACT_EMAIL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
