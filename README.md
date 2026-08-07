# barber-shop
Gerenciador de barbearia

Backend em `backend/` (NestJS + Prisma) e frontend em `frontend/` (Next.js).

## Deploy em VPS com Docker

Pré-requisito: Docker e Docker Compose instalados no VPS ([guia oficial](https://docs.docker.com/engine/install/)).

1. Clone o repositório no VPS:
   ```bash
   git clone https://github.com/Andersonspita/barber-shop.git
   cd barber-shop
   ```

2. Crie o arquivo de variáveis de ambiente a partir do exemplo:
   ```bash
   cp .env.example .env
   nano .env
   ```
   Preencha `POSTGRES_PASSWORD` e `JWT_SECRET` com valores fortes (gere com `openssl rand -base64 48`). Deixe `NEXT_PUBLIC_API_URL` vazio para o frontend chamar a API pelo mesmo domínio, através do nginx.

3. Suba tudo:
   ```bash
   docker compose up -d --build
   ```
   Isso builda e sobe 5 containers: `db` (Postgres), `redis`, `backend`, `frontend` e `nginx` (porta 80). O backend roda `prisma migrate deploy` automaticamente antes de iniciar, aplicando o schema no banco.

4. Acompanhe os logs até tudo subir:
   ```bash
   docker compose logs -f
   ```

5. Acesse `http://IP_DO_VPS` no navegador.

### Atualizando após um novo push

```bash
git pull
docker compose up -d --build
```

### HTTPS / domínio próprio

O `nginx/default.conf` está configurado para HTTP puro (porta 80), sem domínio fixo. Depois de apontar um domínio para o IP do VPS, use o [Certbot](https://certbot.eff.org/) (plugin nginx) diretamente no VPS para emitir certificado TLS e ajustar o `server_name`/porta 443 automaticamente.

### Populando dados de teste (opcional)

```bash
docker compose exec backend npx prisma db seed
```
