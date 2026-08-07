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

   Se as portas 80/443 do VPS já estiverem em uso por outro projeto/painel, ajuste `HTTP_PORT` no `.env` para uma porta livre (padrão: `8080`).

3. Suba tudo:
   ```bash
   docker compose up -d --build
   ```
   Isso builda e sobe 5 containers: `db` (Postgres), `redis`, `backend`, `frontend` e `nginx` (na porta definida em `HTTP_PORT`, `8080` por padrão). O backend roda `prisma migrate deploy` automaticamente antes de iniciar, aplicando o schema no banco.

4. Acompanhe os logs até tudo subir:
   ```bash
   docker compose logs -f
   ```

5. Acesse `http://IP_DO_VPS:8080` no navegador (ou a porta que você definiu em `HTTP_PORT`).

   Se o VPS já roda outro proxy (nginx/OpenResty/painel) na porta 80 pra outros projetos, aponte um domínio ou subdomínio para `http://127.0.0.1:8080` nesse proxy existente — o mesmo jeito que provavelmente já é feito para os outros projetos na VPS.

### Atualizando após um novo push

```bash
git pull
docker compose up -d --build
```

### HTTPS / domínio próprio

O `nginx/default.conf` deste projeto só cuida do roteamento interno (frontend vs. backend) e escuta em HTTP puro na porta `HTTP_PORT`. Ele **não** deve expor 80/443 diretamente se a VPS já tem outro proxy (nginx/OpenResty/painel) cuidando disso para outros projetos.

Nesse cenário, quem emite o certificado TLS e termina HTTPS é o proxy que já existe na VPS: configure lá um domínio/subdomínio (ex: `barbearia.seudominio.com`) como reverse proxy para `http://127.0.0.1:8080` (ou a porta que você definiu em `HTTP_PORT`), do mesmo jeito que os outros projetos já são configurados nele.

### Populando dados de teste (opcional)

```bash
docker compose exec backend npx prisma db seed
```
