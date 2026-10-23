# barber-shop

Gerenciador de barbearias: agendamento online para o cliente, painel de agenda
para o barbeiro e administração para o dono — **várias barbearias na mesma
instalação**, cada uma com endereço, equipe, clientes e agenda próprios.

Backend em `backend/` (NestJS + Prisma + BullMQ) e frontend em `frontend/`
(Next.js 16 + Tailwind 4).

**Guia de uso** com as telas, para clientes, barbeiros, administradores e
operador da plataforma: [`docs/guia-de-uso.pdf`](docs/guia-de-uso.pdf).

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

## Várias barbearias (multi-tenant)

Cada barbearia tem a própria vitrine em `APP_URL/<slug>` — por exemplo
`https://seudominio.com/navalha-de-ouro`. É esse o link que ela divulga. Tudo
abaixo dele é só dela: agendamento (`/<slug>/reservas/nova`), login
(`/<slug>/login`) e painel (`/<slug>/dashboard`). A raiz (`APP_URL/`) lista as
barbearias ativas.

**Isolamento.** Serviços, equipe, clientes, agendamentos, feriados, bloqueios,
lista de espera e financeiro são sempre filtrados pela barbearia. O admin de
uma não vê nem altera nada da outra — um id de outra barbearia responde como
inexistente. O teste `backend/test/tenant-isolation.e2e-spec.ts` cobre esses
cenários contra um banco real.

**Contas.** Cada conta pertence a uma barbearia. O mesmo e-mail pode ter conta
em várias, como contas independentes (senha e histórico próprios). O navegador
guarda uma sessão por barbearia, e o token de uma é recusado na página de outra.

**Painel da plataforma** (`APP_URL/plataforma`). Onde você, que opera o sistema,
cadastra barbearias, troca o endereço, suspende e liga o WhatsApp de cada uma. O acesso é a chave
`PLATFORM_ADMIN_KEY` do `.env` — sem ela o painel fica desligado. Ao criar uma
barbearia, ela já nasce com o primeiro administrador; a senha temporária
aparece uma única vez e a troca é obrigatória no primeiro acesso. Suspender
tira a vitrine do ar e derruba as sessões na hora.

**Atualizando uma instalação que já existe.** A migração não apaga nada: a
barbearia que já estava no ar vira a `principal`, com todos os dados, em
`APP_URL/principal`. Para que links antigos da API sem barbearia continuem
funcionando, defina `DEFAULT_SHOP_SLUG=principal` no `.env`. Os links antigos
do site (`APP_URL/reservas`, `APP_URL/login`) passam a dar 404; divulgue o novo
endereço. O slug pode ser trocado em `/plataforma`, em **Alterar endereço** —
o endereço antigo deixa de funcionar na hora.

## Teste grátis pelo SDR-AI

O [SDR-AI](https://github.com/Andersonspita/SDR-AI-BARBER-SHOP) prospecta barbearias no WhatsApp e, quando o dono topa, cria a barbearia dele aqui já em **teste grátis**:

- `POST /provisioning/trials` com o cabeçalho `X-Provisioning-Key` (`PROVISIONING_API_KEY`). É uma chave separada da `PLATFORM_ADMIN_KEY`: ela só cria testes. A barbearia nasce com o dono (que define a senha por um link de uso único válido por `TRIAL_SETUP_LINK_TTL_HOURS`), a jornada padrão e os serviços Corte, Barba e Combo. O pedido é idempotente pelo lead, e um endereço em uso ganha sufixo (`-2`, `-3`...).
- Um job de hora em hora avisa o dono no WhatsApp 48h antes do fim e, no vencimento, tira a barbearia do ar (`EXPIRED`) sem apagar nada.
- Em `/plataforma`, **Ativar plano** converte o teste (ou um teste vencido) e devolve a barbearia ao ar.
- Cada etapa (`trial.activated`, `trial.expiring`, `trial.expired`, `subscription.activated`) é enviada ao SDR em `SDR_WEBHOOK_URL`, assinada com HMAC-SHA256 (`SDR_WEBHOOK_SECRET`) e com novas tentativas pela fila.

**Avisos ao dono das barbearias vindas do SDR.** Com `SDR_WEBHOOK_URL` e `SDR_WEBHOOK_SECRET` configurados, os avisos de teste (acabando, vencido) e de cobrança (fatura gerada, pagamento confirmado, vencida, suspensa, reativada) **não saem pelo WhatsApp da plataforma**: o aviso vai ao SDR, que o manda na conversa que já tem com o dono e trata a resposta. Para isso o payload leva `name`, `url`, `subscribeUrl`, `invoiceUrl` e `suspendsAt`. Barbearias criadas direto na plataforma continuam recebendo os avisos daqui.

Teste ponta a ponta: `npm run test:e2e -- trial-provisioning` (Postgres e Redis reais).

## Cobrança (Asaas)

A mensalidade de cada barbearia é uma assinatura no [Asaas](https://www.asaas.com), com Pix, boleto ou cartão.

- **Assinar:** o dono escolhe plano e forma de pagamento em **Painel → Assinatura**, e o link da 1ª fatura abre na hora. Para quem não consegue entrar no painel (teste vencido, suspensa), quem opera a plataforma usa **Gerar cobrança** em `/plataforma`, e o link vai no WhatsApp do dono. O CPF/CNPJ vai direto para o Asaas e não fica guardado aqui.
- **Pagou** (`PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED`): o plano ativa sozinho, e a barbearia volta ao ar se estava com o teste vencido ou suspensa.
- **Venceu** (`PAYMENT_OVERDUE`): a barbearia fica `PAST_DUE`, ainda no ar, e o dono recebe o link da fatura. Passados `BILLING_GRACE_DAYS` dias sem pagamento, um job de hora em hora a suspende (`SUSPENDED`, fora do ar, sem apagar dados). O pagamento atrasado a reativa na hora.
- **Ativar sem cobrança** em `/plataforma` continua disponível para pagamentos combinados por fora.

Configuração: crie a chave de API no Asaas (`ASAAS_API_KEY`, **entre aspas simples** no `.env`, porque ela começa com `$` e o Docker Compose a apagaria; use `ASAAS_ENV=production` com chave de produção) e cadastre um webhook para `APP_URL/billing/asaas/webhook` com os eventos de cobrança e um token de autenticação, que vai também em `ASAAS_WEBHOOK_TOKEN`. Eventos repetidos são descartados pelo id.

Preços dos planos: `backend/src/billing/plans.ts`. Teste ponta a ponta: `npm run test:e2e -- billing`.

## Configuração da agenda

Tudo que define os horários fica no banco, por barbearia, editável em
**Painel → Barbearia → Ajustes** — não em variável de ambiente nem no código:

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
   Preencha `POSTGRES_PASSWORD`, `JWT_SECRET` e `PLATFORM_ADMIN_KEY` com
   valores fortes (gere com `openssl rand -base64 48`) e ajuste `APP_URL` para o endereço público do
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

Abra `APP_URL/plataforma`, entre com a `PLATFORM_ADMIN_KEY` e cadastre a
primeira barbearia com o administrador dela. Ele entra em
`APP_URL/<slug>/login?area=profissional` e monta equipe, serviços e horários.
Contas criadas pelo administrador também recebem uma **senha temporária
sorteada**, mostrada uma única vez na tela, e a troca é obrigatória no primeiro
login.

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

Essa é a instância padrão da plataforma. Cada barbearia pode ter o próprio
número: conecte uma instância nova na Evolution API e informe o nome dela na
barbearia, em `APP_URL/plataforma`. Sem instância própria, as mensagens da
barbearia saem pelo número padrão, sempre com o nome dela no texto.

**Sem essas variáveis o sistema continua funcionando normalmente**: as mensagens
vão para o log do backend (`docker compose logs backend`) em vez de sair pelo
WhatsApp. Útil para testar antes de conectar o número.

O lembrete sai 2 horas antes por padrão (`REMINDER_HOURS_BEFORE`) e é retirado
da fila automaticamente se o agendamento for cancelado ou remarcado. As
felicitações de aniversário saem às 9h no fuso de cada barbearia
(`BIRTHDAY_GREETING_HOUR`).

## Populando dados de teste (opcional)

```bash
docker compose exec backend npx prisma db seed
```

Cria duas barbearias — `principal` (São Paulo) e `navalha-de-ouro` (Recife) —
com equipe, serviços, jornada da semana e o mesmo cliente cadastrado nas duas,
para ver o isolamento na prática. As credenciais aparecem no final da saída do
comando. **O seed apaga os dados existentes: não rode em produção.**

## Desenvolvimento

```bash
# backend
cd backend && npm install && npm run start:dev

# frontend
cd frontend && npm install && npm run dev
```

O backend precisa de Postgres e Redis acessíveis (veja `DATABASE_URL`,
`REDIS_HOST` e `REDIS_PORT`). Em desenvolvimento, o frontend também lê
`API_INTERNAL_URL` (endereço da API para o servidor Next; padrão
`NEXT_PUBLIC_API_URL` ou `http://localhost:3333`).

Testes do backend:

```bash
cd backend && npm test

# isolamento entre barbearias, contra Postgres e Redis reais (use um banco
# de teste; o teste cria e apaga as próprias barbearias)
cd backend && npm run test:e2e -- tenant-isolation
```
