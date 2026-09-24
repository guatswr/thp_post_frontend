# THP Post 前端：独立 Docker 部署

此目录就是完整的前端构建上下文。只需复制此目录，不需要仓库根目录或后端源码。Caddy 服务 `/host`、`/screen`、静态资源和 `/api/*` 代理；主机公网只开放 80/443。

```bash
docker network inspect thp_post_net >/dev/null 2>&1 || docker network create thp_post_net
cp .env.example .env
# 设置真实的 THP_DOMAIN、ACME_EMAIL；THP_DOMAIN 与后端 .env 一致
# 服务器无法访问 Docker Hub 时，在 .env 增加 DOCKER_REGISTRY=docker.1panel.live
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
curl --fail https://你的域名/api/v1/health/ready
```

默认后端地址 `http://thp-post-backend:8000` 是共享 Docker 网络上的后端别名。后端由其自己的 Compose 单独管理，不由本项目启动。纯前端升级在**本目录**执行 `docker compose build && docker compose up -d`。Caddy 证书保存在本项目持久化卷中；不要运行 `down -v`。

如果后端放在别的主机，需要先建立有访问控制的网络连接和受保护的后端入口，再在 `.env` 中将 `THP_BACKEND_UPSTREAM` 指向该入口，并验证代理来源地址、TLS、SSE 实时性和后端 Origin 设置。
