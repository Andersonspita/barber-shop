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
regras da agenda, e a assinatura da barbearia (plano e faturas).

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
cadastra barbearias, troca o endereço, suspende, liga o WhatsApp e cuida da
mensalidade de cada uma. O acesso é a chave
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

## Mensalidade das barbearias

Cada barbearia paga uma mensalidade conforme o número de **profissionais
ativos** (administradores que não atendem não contam):

| Plano        | Profissionais | Mensalidade                                   |
| ------------ | ------------- | --------------------------------------------- |
| Solo         | 1             | R$ 35,00                                      |
| Essencial    | até 3         | R$ 89,90                                      |
| Profissional | até 6         | R$ 149,90                                     |
| Premium      | até 10        | R$ 219,90                                     |
| Rede         | sem limite    | R$ 219,90 com 10 inclusos + R$ 19,90 por extra |

Os preços ficam no banco e são editáveis em `/plataforma` → **Planos e
preços**. Mudar um preço vale para as próximas faturas; as já geradas não
mudam.

**Ciclo.** A barbearia nova nasce no plano escolhido (padrão Solo) com
`BILLING_TRIAL_DAYS` dias de teste grátis. A mensalidade é paga adiantada: a
primeira fatura cobre o mês que começa no fim do teste e vence nesse dia; as
seguintes emendam na anterior. Cada fatura é gerada
`BILLING_INVOICE_DAYS_BEFORE` dias antes do vencimento, e o administrador da
barbearia é avisado pelo WhatsApp.

**Atraso.** Vencida, a fatura deixa a assinatura **em atraso**, e tudo segue
funcionando por `BILLING_GRACE_DAYS` dias. Passada a tolerância, só o
**agendamento online dos clientes** é pausado: a vitrine mostra o contato da
barbearia no lugar do botão de agendar. Agenda, encaixes, painel e horários já
marcados continuam normais. O administrador recebe um aviso no atraso e outro
na pausa.

**Pagamento.** Ainda não há integração com cartão ou Pix: o pagamento é
combinado por fora (o texto de `BILLING_PAYMENT_INSTRUCTIONS` aparece para o
administrador e nas mensagens) e você dá a **baixa manual** em `/plataforma` →
**Assinatura** → **Marcar como paga**. A baixa libera o agendamento na hora.

**Limite do plano.** Cadastrar ou reativar um profissional além do limite é
recusado com a indicação do plano que comporta a equipe. O administrador troca
de plano sozinho em **Painel → Assinatura**; não é possível ir para um plano
menor que a equipe atual.

**Cortesia.** Barbearias marcadas como cortesia não geram fatura nem têm limite
de profissionais. Na atualização, todas as barbearias que já existiam viram
cortesia, no plano que comporta a equipe delas; tire a marcação em
`/plataforma` → **Assinatura** quando for começar a cobrar.

No painel da plataforma, cada barbearia mostra a situação (cortesia, teste
grátis, em dia, em atraso, agendamento pausado). Em **Assinatura** dá para
trocar o plano, mudar o fim do teste, marcar cortesia, gerar a próxima fatura
na hora e cancelar ou reabrir faturas. Uma rotina de hora em hora gera as
faturas e envia os avisos, sem duplicar.

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
primeira barbearia com o administrador dela, o plano e os dias de teste. Ele entra em
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
para ver o isolamento na prática. A `principal` fica no plano Essencial e a
`navalha-de-ouro` no Solo, ambas em teste grátis de 14 dias. As credenciais aparecem no final da saída do
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

# mensalidade: teste grátis, limite do plano, atraso, pausa e baixa manual
cd backend && npm run test:e2e -- billing
```
