FROM node:20-slim AS build

WORKDIR /app

ARG VITE_ADSENSE_CLIENT=ca-pub-8314082563234213
ARG VITE_ADSENSE_SLOT=
ENV VITE_ADSENSE_CLIENT=$VITE_ADSENSE_CLIENT
ENV VITE_ADSENSE_SLOT=$VITE_ADSENSE_SLOT

COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# --- Production stage ---
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html/oky-docky
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
