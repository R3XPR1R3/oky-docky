FROM node:20-slim AS build

WORKDIR /app/front

ARG VITE_ADSENSE_CLIENT=ca-pub-8314082563234213
ARG VITE_ADSENSE_SLOT=1815198011
ENV VITE_ADSENSE_CLIENT=$VITE_ADSENSE_CLIENT
ENV VITE_ADSENSE_SLOT=$VITE_ADSENSE_SLOT

COPY front/package.json front/package-lock.json* front/pnpm-lock.yaml* ./
RUN npm install --legacy-peer-deps

COPY front/ .
COPY back/data/templates/ /app/back/data/templates/
RUN npm run build

# --- Production stage ---
FROM nginx:alpine

COPY --from=build /app/front/dist /usr/share/nginx/html/oky-docky
COPY front/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
