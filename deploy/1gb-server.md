# 1G 服务器部署方式

这个项目不要在 1G 服务器上执行前端构建或完整 `docker compose up --build`。推荐做法是：本地构建前端，服务器只运行后端和可选数据库。

## 推荐结构

- 前端：本地 `npm run build --workspace @sollll/frontend` 后上传 `apps/frontend/dist` 到宝塔站点目录。
- 后端：服务器运行已构建的 `apps/backend/dist/server.js`，用 PM2 或单独 Docker 容器守护。
- 数据库：优先使用外部 PostgreSQL 或宝塔已有数据库；必须同机运行时再使用 `docker-compose.postgres.yml`。

## 本地构建

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run build
```

上传这些内容到服务器：

- `apps/backend/dist`
- `apps/backend/package.json`
- `prisma`
- `package.json`
- `package-lock.json`
- `.env`
- `ecosystem.config.cjs`
- `apps/frontend/dist` 里的所有文件到宝塔网站根目录

## 服务器后端部署（PM2）

```bash
npm install --omit=dev
npm run prisma:generate
npm run prisma:deploy
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

`.env` 里建议：

```bash
NODE_ENV=production
PORT=4000
TRUST_PROXY=1
CORS_ORIGIN=https://solstake.mom
DATABASE_URL=postgresql://user:password@127.0.0.1:5432/sollll?schema=public
```

## 可选：同机 PostgreSQL

只有没有外部数据库时使用：

```bash
docker compose -f docker-compose.postgres.yml up -d
```

这份配置限制了 PostgreSQL 内存和连接数，更适合 1G 机器。

## 宝塔反代

在宝塔里：

1. 前端建议放 Cloudflare Pages，绑定 `https://solstake.mom`。
2. 宝塔只建 API 站点 `api.solstake.mom`，把 `/api/` 转发到 `http://127.0.0.1:4000/api/`。
3. 开启 HTTPS 后，确保 `.env` 中 `CORS_ORIGIN` 使用 `https://` 域名。

可参考 `deploy/nginx.bt-panel.conf`。
