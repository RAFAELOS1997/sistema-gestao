# Toca da Pantera — Sistema de Gestão

Leia este arquivo inteiro antes de fazer qualquer coisa. Ele existe pra que
qualquer sessão nova (em qualquer aparelho — computador, celular, o que for)
chegue já sabendo o que é este projeto, onde tudo está e como as coisas
funcionam aqui, sem o Rafael precisar reexplicar do zero.

## Quem é o dono e como se comunicar com ele

O Rafael é dono de uma loja de artigos umbandistas/religiosos (a "Toca da
Pantera") e **não é técnico**. Ele não sabe programar, não conhece termos
técnicos, e não vai entender respostas cheias de jargão.

- **Fale sempre em português.**
- Explique de forma simples e direta o que foi feito e o que ele precisa
  fazer (se algo). Nada de "fiz o deploy da feature X no endpoint Y" — diga
  "coloquei no ar o botão tal, ele fica em tal lugar, funciona assim".
- Ele autoriza mudanças de forma ampla ("conserta o sistema do jeito que
  quiser", "melhora o sistema") — não precisa ficar pedindo permissão pra
  cada ajuste técnico razoável. Faça o trabalho, suba pro ar, e explique
  depois em linguagem simples.
- Sempre que mexer em algo visível pro usuário, **verifique que o deploy
  realmente subiu** antes de dizer que terminou (ver seção de deploy
  abaixo) — não informe "está no ar" sem confirmar.
- Ele opera o negócio pelo celular também — o site é instalável como app
  (Chrome → menu → "Adicionar à tela inicial").

## O que é este sistema

Gestão de estoque, vendas (PDV), compras, fornecedores e relatórios pra loja
física + Instagram. Rodando em produção, uso diário real do Rafael — não é
protótipo.

- **URL ao vivo (admin):** https://sistema.tocadapantera.com.br — painel
  de gestão (login, dashboard, vendas, estoque etc.)
- **URL ao vivo (loja pública):** https://tocadapantera.com.br — domínio
  principal, "estacionado" (alias) em cima do mesmo Web App desde
  2026-07-21. É o MESMO app/deploy dos dois domínios — `client/src/pages/Home.tsx`
  decide pra onde mandar a `/` olhando `window.location.hostname`:
  `tocadapantera.com.br`/`www.tocadapantera.com.br` → `/loja/produtos`
  (loja), qualquer outro host (inclusive `sistema.tocadapantera.com.br`) →
  `/dashboard` (admin). Não existe roteamento por domínio no servidor, é só
  esse client-side redirect.
- **Repositório:** https://github.com/RAFAELOS1997/sistema-gestao (branch
  `main`, usuário RAFAELOS1997). Todo push pra `main` dispara auto-deploy na
  Hostinger.
- **Cópia local de trabalho:** `D:\Downloads\sistema-gestao` (na máquina
  Windows do Rafael). Existe também `D:\Downloads\toca-da-pantera-main`, que
  é uma cópia de referência mais antiga — **não é o projeto ativo**, não
  editar lá.
- **⚠️ Múltiplas IAs editando o MESMO repositório:** Rafael usa mais de um
  assistente de IA nesse projeto — sessões de Claude Code (desktop, celular/
  web) E, a partir de 2026-07-23, também o **Antigravity CLI** do Google
  (comando `agy`, sucessor do descontinuado "Gemini CLI" — rodando local,
  apontado pra essa mesma pasta). Isso já causou um conflito real uma
  vez (duas sessões de Claude construindo a mesma feature ao mesmo tempo,
  uma teve que descartar o próprio trabalho). Se você é uma IA lendo isto:
  **sempre rode `git fetch && git log HEAD..origin/main` ANTES de começar
  uma feature nova** (não só antes do push) pra pegar trabalho concorrente
  cedo. Se encontrar commits recentes de estilo/padrão diferente do seu
  (nomes de variável, comentários, convenções), é provável que sejam de
  outra IA — leia o código antes de assumir que está quebrado ou errado.
- **Hospedagem:** Hostinger "Web Apps" (Node.js), subdomínio
  `sistema.tocadapantera.com.br`. `tocadapantera.com.br` era um site vazio
  separado (hospedagem PHP/HTML padrão, "reservado pra futuro site de
  vendas") — foi apagado em 2026-07-21 e o domínio "estacionado" (Hostinger
  → site do Web App → Domínios → Domínios Estacionados) na frente do Web
  App, pra virar a loja de verdade.

## Stack técnica

Node.js 22 + Express + tRPC + React 19/Vite + Drizzle ORM + MySQL +
Tailwind v4 + wouter (rotas) + **pnpm** (gerenciador de pacotes — **nunca
use npm**, o projeto fixa `packageManager: pnpm@11.13.1` no package.json e
já existe `pnpm-lock.yaml` versionado; um `package-lock.json` do npm é
ignorado pelo git de propósito).

**Banco de dados:** MySQL `u849479574_sistema_gestao` em `srv804.hstgr.io`
(não é `localhost` — a Hostinger Web App roda num container separado do
banco). Acesso remoto liberado (`%`).

**Autenticação:** login local por email/senha (scrypt), não é mais o OAuth
do Manus original (esse morreu quando o sistema saiu do Manus). Conta admin:
Rafael / tocadapantera.rp@gmail.com.

## Como funciona o deploy (importante)

Não existe SSH nem terminal na Hostinger, e normalmente **você (a sessão do
Claude) não tem a senha do banco de dados nem login no próprio sistema** —
trabalhe só através do código + git.

1. Edite o código.
2. Rode `npx tsc --noEmit` e confira que compila limpo.
3. `git add` só os arquivos relevantes (nunca `git add -A` sem olhar
   — pode pegar `package-lock.json` ou outra sobra).
4. Commit com mensagem em português explicando o "porquê", não só o "o quê".
5. `git push origin main` — isso dispara o build/deploy automático.
6. **Confirme que o deploy realmente subiu** antes de avisar o usuário:
   pegue o hash do bundle JS atual (`curl -s https://sistema.tocadapantera.com.br/
   | grep -o 'src="/assets/index-[^"]*\.js"'`) antes de fazer push, depois
   use o Monitor (ou um loop de curl) esperando esse hash mudar. Deploys
   levam tipicamente 1–3 minutos. **Atenção:** se a mudança foi só no
   servidor (arquivos em `server/`, sem tocar em nada de `client/`), o hash
   do bundle **não muda** (o JS do cliente é idêntico) — nesse caso não dá
   pra usar essa checagem; só espere um tempo razoável e confirme que a
   rota responde 200.
7. Só depois de confirmar, avise o Rafael em português simples.

**Mudança de schema do banco (migrations):** o `drizzle-kit migrate` nunca
roda sozinho no deploy da Hostinger, e você normalmente não tem acesso
direto ao banco pra rodar SQL manual. O padrão que funciona: gere a
migration localmente pra manter o histórico (
`DATABASE_URL="mysql://dummy:dummy@localhost:3306/dummy" npx drizzle-kit generate`
— não precisa de banco real, só gera o arquivo comparando com os
snapshots), **e também** escreva uma função em `server/db.ts` que roda o
`ALTER TABLE` correspondente via `db.execute(sql\`...\`)`, de forma
**idempotente** (segura de rodar de novo sem quebrar), chamada a partir de
alguma mutation que já vai ser executada pelo usuário logado (ex.: o
próprio botão que passa a usar a coluna nova). Assim a migração "acontece
sozinha" na primeira vez que alguém usa a função em produção, sem precisar
de acesso direto ao banco. Exemplos reais: `ensureProductImageColumn()` e
`ensureProductImageColumnIsMediumtext()` em `server/db.ts`.

**Cuidado com erro de duplicate-column:** o `drizzle-orm/mysql2` embrulha o
erro real do driver MySQL em `error.cause`, não no nível de cima
(`error.code`/`error.message`). Se for checar "coluna já existe" num
catch, cheque `error?.cause?.code` também, senão o erro vaza pro usuário
mesmo sendo inofensivo (já aconteceu, foi bug real).

**Ambiente Windows local:** `npm run dev` não funciona no cmd.exe porque o
script usa sintaxe de env var inline (`NODE_ENV=development tsx ...`) que é
POSIX-only. Use `run-dev.cmd` (na raiz do projeto) em vez disso, ou
configure `.claude/launch.json` apontando pra ele.

## O que já existe no sistema (histórico resumido)

Construído originalmente via Manus (scaffold inicial: dashboard, produtos,
vendas, compras, fornecedores, configurações, controle de vendas, recibos —
ver `todo.md` e `analise_sistema.md` na raiz, são anotações antigas da
época do Manus, meio desatualizadas mas dão contexto histórico). Depois
migrado pra hospedagem própria (Hostinger) com autenticação local.

Nas sessões mais recentes (já fora do Manus, com Claude Code):

- **Logo real da loja** em todo lugar (login, sidebar, recibos, favicon,
  ícones PWA), substituindo placeholders.
- **"O Oráculo"** — era um módulo de consulta por IA que não funcionava
  (sem chave de LLM configurada). Foi **transformado** num catálogo de
  produtos do fornecedor Atacado de Umbanda (atacadodeumbanda.com.br):
  nome, foto, preço, preço sugerido de venda, com atualização sob demanda
  (não busca tudo de novo toda vez) e importação em massa de ~70
  categorias do site do fornecedor. Fica em `/oraculo`, tabela
  `supplierCatalog`, lógica em `server/_core/supplierScraper.ts` e
  `supplierCatalogRouter` em `server/routers.ts`.
- **Fotos dos produtos do estoque**: coluna `products.imageUrl` (virou
  MEDIUMTEXT pra caber upload de foto do dispositivo em base64). Botão
  "Puxar fotos do Oráculo" casa produto do estoque com item do catálogo
  por nome (com tolerância a nome parecido, não só idêntico — usa
  `normalizeProductName`/`tokenizeProductName`/`nameCoverage`, funções
  compartilhadas em `routers.ts`), com painel de revisão pra casamentos
  incertos. Fallback "Buscar direto no site do fornecedor" quando não acha
  no catálogo local. **Edição manual da foto** (upload do dispositivo com
  redimensionamento automático no navegador, ou colar link) no mesmo
  formulário de criar/editar produto — vale tanto pra produto novo quanto
  pros já cadastrados.
- **Fotos clicáveis pra ampliar** em qualquer lugar que mostra foto de
  produto (exceto na tela de Vendas, onde o clique na foto serve pra outra
  coisa) — componente `client/src/components/ZoomableImage.tsx`.
- **Tela de Vendas reformulada**: carrinho fixo (`sticky bottom-0`) na
  parte de baixo da tela em vez de barra lateral, recolhido por padrão
  (total + qtd., clique expande); produtos paginados de 10 em 10;
  alternância grade/lista; botões +/- em cada produto pra ajustar
  quantidade direto, sem precisar abrir o carrinho; preço editável por
  item (pra quando negocia no balcão); desconto em % ou R$; calculadora de
  troco (pagamento em dinheiro); canal da venda (Loja Física/Instagram).
- **Gestão de Produtos**: busca, filtro por categoria, mostrar/ocultar
  inativos, visão em cards no celular.
- **Instalável como PWA** (manifest.webmanifest + ícones gerados da logo).
- **Ferramenta pontual de auditoria** em `/conferencia-pedido-7335` (não
  está no menu, foi uma correção de custos de um pedido específico do
  fornecedor que veio errado) — pode servir de modelo se precisar fazer
  outra conferência parecida no futuro.

## Onde encontrar mais contexto

Fora deste arquivo, existe também um sistema de memória do Claude Code na
máquina local do Rafael (`C:\Users\Rafael\.claude\projects\D--\memory\`)
com notas mais detalhadas sessão a sessão — mas **isso só existe nesse
computador específico**, uma sessão nova em outro aparelho (celular, outro
PC) não tem acesso a ela. Por isso este `CLAUDE.md` tenta ser
autossuficiente: se você está lendo isso vindo de outro lugar, o que está
escrito aqui é o que você tem pra trabalhar — o resto é olhar o código e o
`git log`.
