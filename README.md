# barber-shop

Gerenciador de barbearia: agendamento online para o cliente, painel de agenda
para o barbeiro e administração para o dono.

Backend em `backend/` (NestJS + Prisma + BullMQ) e frontend em `frontend/`
(Next.js 16 + Tailwind 4).

## O que o sistema faz

**Cliente** — vê serviços, preços e equipe na página inicial; agenda escolhendo
serviço, profissional e horário; recebe confirmação e lembrete no WhatsApp;
remarca ou cancela; entra na lista de espera quando o dia está cheio; avalia o
atendimento.

**Barbeiro** — agenda do dia com conclusão, remarcação, cancelamento e registro
de falta; encaixe de balcão para quem chega sem marcar; bloqueio pontual de
horário; relatório financeiro com comissão.

**Administrador** — agenda da barbearia inteira, cadastro de clientes, equipe
(com jornada semanal e comissão por profissional), serviços, feriados e as
regras da agenda.

## Configuração da agenda

Tudo que define os horários fica no banco, editável em **Painel → Barbearia →
Ajustes** — não em variável de ambiente nem no código:

- **Fuso horário** da barbearia (padrão `America/Sao_Paulo`). O contêiner roda
  em UTC; a conversão é feita pela aplicação.
- **Intervalo entre horários**, **antecedência mínima** para marcar, **horizonte
  máximo** de agendamento e **prazo de cancelamento** pelo cliente.
- **Jornada por barbeiro e dia da semana**, com vários turnos por dia (é assim
  que se representa a pausa do almoço). Em **Painel → Equipe → Jornada**.
- **Feriados** e fechamentos da casa inteira.
- **Serviços por profissional**, com preço e duração opcionalmente diferentes.
  Um barbeiro sem nenhum serviço vinculado atende todos.

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
   Preencha `POSTGRES_PASSWORD` e `JWT_SECRET` com valores fortes (gere com
   `openssl rand -base64 48`) e ajuste `APP_URL` para o endereço público do
   site — ele entra nos links de recuperação de senha e define a origem aceita
   pelo CORS. Deixe `NEXT_PUBLIC_API_URL` vazio para o frontend chamar a API
   pelo mesmo domínio, através do nginx.

   Se as portas 80/443 do VPS já estiverem em uso por outro projeto/painel,
   ajuste `HTTP_PORT` no `.env` para uma porta livre (padrão: `8080`).

3. Suba tudo:
   ```bash
   docker compose up -d --build
   ```
   Isso builda e sobe 5 containers: `db` (Postgres), `redis`, `backend`,
   `frontend` e `nginx` (na porta definida em `HTTP_PORT`, `8080` por padrão).
   O backend roda `prisma migrate deploy` automaticamente antes de iniciar,
   aplicando o schema no banco.

4. Acompanhe os logs até tudo subir:
   ```bash
   docker compose logs -f
   ```

5. Acesse `http://IP_DO_VPS:8080` no navegador (ou a porta que você definiu em
   `HTTP_PORT`).

   Se o VPS já roda outro proxy (nginx/OpenResty/painel) na porta 80 pra outros
   projetos, aponte um domínio ou subdomínio para `http://127.0.0.1:8080` nesse
   proxy existente — o mesmo jeito que provavelmente já é feito para os outros
   projetos na VPS.

### Primeiro acesso

Sem dados no banco, cadastre o primeiro administrador direto pelo banco ou rode
o seed de exemplo (abaixo) e troque as senhas em seguida. Contas criadas pelo
administrador recebem uma **senha temporária sorteada**, mostrada uma única vez
na tela, e a troca é obrigatória no primeiro login.

### Atualizando após um novo push

```bash
git pull
docker compose up -d --build
```

### HTTPS / domínio próprio

O `nginx/default.conf` deste projeto só cuida do roteamento interno (frontend
vs. backend) e escuta em HTTP puro na porta `HTTP_PORT`. Ele **não** deve expor
80/443 diretamente se a VPS já tem outro proxy (nginx/OpenResty/painel)
cuidando disso para outros projetos.

Nesse cenário, quem emite o certificado TLS e termina HTTPS é o proxy que já
existe na VPS: configure lá um domínio/subdomínio (ex:
`barbearia.seudominio.com`) como reverse proxy para `http://127.0.0.1:8080` (ou
a porta que você definiu em `HTTP_PORT`), do mesmo jeito que os outros projetos
já são configurados nele.

## WhatsApp (Evolution API)

As mensagens — confirmação, lembrete, remarcação, cancelamento, lista de espera
e aniversário — saem por uma instância da [Evolution API](https://doc.evolution-api.com/).
Preencha no `.env`:

```
EVOLUTION_API_URL=https://sua-instancia
EVOLUTION_API_KEY=sua-chave
EVOLUTION_INSTANCE=barbearia
```

**Sem essas variáveis o sistema continua funcionando normalmente**: as mensagens
vão para o log do backend (`docker compose logs backend`) em vez de sair pelo
WhatsApp. Útil para testar antes de conectar o número.

O lembrete sai 2 horas antes por padrão (`REMINDER_HOURS_BEFORE`) e é retirado
da fila automaticamente se o agendamento for cancelado ou remarcado. As
felicitações de aniversário saem às 9h no fuso da barbearia
(`BIRTHDAY_GREETING_HOUR`).

## Populando dados de teste (opcional)

```bash
docker compose exec backend npx prisma db seed
```

Cria dois profissionais, quatro serviços, um cliente e a jornada da semana. As
credenciais aparecem no final da saída do comando. **Troque as senhas antes de
usar em produção.**

## Desenvolvimento

```bash
# backend
cd backend && npm install && npm run start:dev

# frontend
cd frontend && npm install && npm run dev
```

O backend precisa de Postgres e Redis acessíveis (veja `DATABASE_URL`,
`REDIS_HOST` e `REDIS_PORT`).

Testes do backend:

```bash
cd backend && npm test
```
