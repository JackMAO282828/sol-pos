FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY prisma prisma
RUN npm install

FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/backend apps/backend
RUN npm run prisma:generate
RUN npm run build --workspace @sollll/backend

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY apps/backend/package.json apps/backend/package.json
COPY prisma prisma
RUN npm install --omit=dev
RUN npm run prisma:generate
COPY --from=build /app/apps/backend/dist apps/backend/dist
EXPOSE 4000
CMD ["npm", "run", "start", "--workspace", "@sollll/backend"]
