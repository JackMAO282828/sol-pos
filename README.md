# SOL POS

SOL hashrate purchase MVP with React, Express, PostgreSQL, Prisma, and Docker.

## Local development

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:4000`

Production frontend: `https://solstake.mom`

Production API: `https://api.solstake.mom`

## 1G server deployment

For a 1G RAM server, use the lightweight deployment flow:

1. Build frontend and backend locally.
2. Upload `apps/frontend/dist` to BT Panel or Nginx static site root.
3. Run only the backend on the server with PM2 or the lightweight backend Docker container.
4. Prefer an external PostgreSQL database. If PostgreSQL must run on the same server, use the limited-memory compose file.

Detailed guide: `deploy/1gb-server.md`

BT Panel Nginx example: `deploy/nginx.bt-panel.conf`

## Backend-only Docker

```bash
cp .env.example .env
docker compose up -d --build backend
docker compose exec backend npm run prisma:deploy
```

This exposes the API only on `127.0.0.1:4000`, so BT Panel or Nginx can reverse proxy `/api` safely.

## Optional local PostgreSQL on a small server

```bash
docker compose -f docker-compose.postgres.yml up -d
```

Use this only if you do not have an external PostgreSQL service.
