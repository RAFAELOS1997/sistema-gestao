# Sistema de Gestão — Guia de Instalação (Hostinger Premium)

Este pacote é o backend novo do seu sistema, escrito em **PHP + MySQL**
(compatível com hospedagem compartilhada, sem precisar de Node.js).

## O que já está pronto

- ✅ Login de usuários/funcionários (com cargos: admin, gerente, vendedor)
- ✅ Controle de estoque/produtos (cadastrar, editar, listar, buscar)
- ✅ Vendas / PDV (registra venda, baixa estoque automaticamente, permite cancelar)
- ✅ Relatórios (faturamento por período, produtos mais vendidos, resumo do dia, estoque baixo)

## Passo 1 — Criar o banco de dados na Hostinger

1. No hPanel, vá em **Bancos de Dados > Bancos de Dados MySQL**.
2. Crie um novo banco (anote o nome, usuário e senha gerados).
3. Clique em **phpMyAdmin** ao lado do banco criado.
4. Vá na aba **SQL**, abra o arquivo `database/schema.sql` deste pacote,
   copie todo o conteúdo e cole ali. Clique em **Executar**.
   - Isso cria todas as tabelas e um usuário administrador padrão:
     - Email: `admin@sistema.com`
     - Senha: `admin123` (troque assim que entrar pela primeira vez!)

## Passo 2 — Configurar a conexão do backend

1. Abra o arquivo `backend/config/database.php`.
2. Preencha as 4 linhas com os dados do banco que você criou no Passo 1:
   ```php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'u000000000_gestao');
   define('DB_USER', 'u000000000_usuario');
   define('DB_PASS', 'sua_senha_aqui');
   ```

## Passo 3 — Enviar os arquivos para a Hostinger

O sistema vai rodar na subpasta `/gestao` de `tocadapantera.com.br`
(o domínio principal fica livre para o futuro site de vendas).

1. No hPanel, vá em **Arquivos > Gerenciador de Arquivos**.
2. Entre na pasta `public_html`.
3. Crie uma pasta chamada `gestao` dentro de `public_html`.
4. Dentro de `gestao`, crie uma pasta `api` e envie todo o conteúdo da pasta
   `backend/` deste pacote para dentro dela (mantendo a estrutura `api/`,
   `config/`, `.htaccess`).
   - Resultado final deve ficar: `public_html/gestao/api/config/database.php`,
     `public_html/gestao/api/produtos.php`, etc.

## Passo 4 — Testar se a API está funcionando

Abra no navegador:
```
https://tocadapantera.com.br/gestao/api/auth.php?acao=verificar
```
Se aparecer `{"logado":false}`, a API está no ar. Se der erro 500, revise o Passo 2.

## Passo 5 — O frontend (React)

O frontend (as telas que o usuário vê) continua em React — isso **não muda**,
porque um site em React vira arquivos HTML/CSS/JS estáticos depois de compilado,
e qualquer hospedagem compartilhada consegue servir isso normalmente.

Quando você tiver as telas prontas, o processo é:
1. Rodar `npm run build` no projeto React (gera uma pasta `dist/`).
2. Enviar o conteúdo de `dist/` para `public_html/gestao/` (dentro da subpasta,
   não na raiz do domínio — a raiz fica reservada pro site de vendas futuro).
3. Nas chamadas de API do React, apontar para
   `https://tocadapantera.com.br/gestao/api/...`.

**Ainda não geramos o frontend novo** — isso é o próximo passo. Me diga como
eram as telas do sistema antigo (feito no Manus) que eu monto as páginas em
React já conectadas a essa API.

## Referência rápida dos endpoints da API

| Ação | Método | URL |
|---|---|---|
| Login | POST | `/gestao/api/auth.php?acao=login` (body: `{email, senha}`) |
| Logout | POST | `/gestao/api/auth.php?acao=logout` |
| Listar produtos | GET | `/gestao/api/produtos.php` |
| Buscar produto | GET | `/gestao/api/produtos.php?busca=texto` |
| Criar produto | POST | `/gestao/api/produtos.php` |
| Editar produto | PUT | `/gestao/api/produtos.php` (body precisa ter `id`) |
| Excluir produto | DELETE | `/gestao/api/produtos.php?id=5` |
| Registrar venda | POST | `/gestao/api/vendas.php` (body: `{itens:[{produto_id, quantidade}], forma_pagamento, desconto}`) |
| Listar vendas | GET | `/gestao/api/vendas.php?data_inicio=2026-07-01&data_fim=2026-07-13` |
| Cancelar venda | DELETE | `/gestao/api/vendas.php?id=10` |
| Faturamento por dia | GET | `/gestao/api/relatorios.php?tipo=vendas_periodo` |
| Produtos mais vendidos | GET | `/gestao/api/relatorios.php?tipo=produtos_mais_vendidos` |
| Resumo do dia | GET | `/gestao/api/relatorios.php?tipo=resumo_dia` |
| Estoque baixo | GET | `/gestao/api/relatorios.php?tipo=estoque_baixo` |

**Nota sobre o `.htaccess` de proteção:** o arquivo `backend/.htaccess` bloqueia
a pasta `/config/` usando um caminho fixo (`^/config/`). Como agora tudo mora
dentro de `/gestao/api/`, o caminho real é `/gestao/api/config/` — o Apache
compara o caminho a partir da pasta onde o `.htaccess` está, então funciona
sem precisar editar nada, mas se notar que `database.php` está acessível pelo
navegador, me avise que ajustamos a regra.
