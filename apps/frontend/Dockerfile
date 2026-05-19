FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL
ARG VITE_SOLANA_RPC_URL
ARG VITE_STAKE_RECEIVER_ADDRESS
ARG VITE_TELEGRAM_URL
ARG VITE_X_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SOLANA_RPC_URL=$VITE_SOLANA_RPC_URL
ENV VITE_STAKE_RECEIVER_ADDRESS=$VITE_STAKE_RECEIVER_ADDRESS
ENV VITE_TELEGRAM_URL=$VITE_TELEGRAM_URL
ENV VITE_X_URL=$VITE_X_URL
COPY package.json package-lock.json* ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/package.json apps/backend/package.json
RUN npm install
COPY tsconfig.base.json ./
COPY apps/frontend apps/frontend
RUN npm run build --workspace @sollll/frontend

FROM nginx:1.27-alpine
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
