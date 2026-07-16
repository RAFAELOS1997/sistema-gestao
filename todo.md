# Toca da Pantera - Sistema de Gestão

## Banco de Dados
- [x] Tabela `products`: nome, categoria, preço de custo, preço de venda, estoque atual, estoque mínimo, descrição
- [x] Tabela `sales`: produto (FK), quantidade, preço unitário, preço total, lucro, canal, data
- [x] Gerar migration e aplicar via webdev_execute_sql

## Backend (tRPC)
- [x] Router `products`: list, create, update, getMargin
- [x] Router `sales`: create (com desconto automático de estoque), list
- [x] Router `analytics`: dashboard (KPIs), byCategory
- [x] Registrar routers em server/routers.ts

## Frontend
- [x] Corrigir DashboardLayout: menu em português (Dashboard, Gestão de Produtos, Registro de Vendas), ícones corretos, textos em PT-BR
- [x] Atualizar App.tsx: rotas /dashboard, /products, /sales com DashboardLayout
- [x] Corrigir index.css: aplicar tema preto/dourado metálico consistente
- [x] Página Dashboard.tsx: KPIs, gráficos (PieChart, BarChart), resumo financeiro
- [x] Página Products.tsx: tabela de produtos, dialog criar/editar, cálculo de margem
- [x] Página Sales.tsx: dialog nova venda, histórico de vendas
- [x] Corrigir bug monetário: parseInt → parseFloat em todos os campos de preço
- [x] Home.tsx: redirecionar para /dashboard

## Testes
- [x] Vitest para routers de produtos, vendas e analytics

## Entrega
- [x] Checkpoint final

## Módulo Oráculo
- [x] Copiar OracleConsultation.tsx para client/src/pages/
- [x] Adicionar rota /oracle em App.tsx
- [x] Adicionar item "O Oráculo" ao menu do DashboardLayout


## Integração LLM do Oráculo
- [x] Ler referência de integração LLM
- [x] Criar router tRPC oracle.consult com JSON schema estruturado
- [x] Integrar invokeLLM com prompt especializado em mercado de artigos religiosos
- [x] Atualizar OracleConsultation.tsx com exibição de resultados
- [x] Adicionar seleção de categorias (Umbanda, Candomblé, Quimbanda, Catolicismo, Geral)
- [x] Implementar loading state e feedback visual (toast)
- [x] Testar TypeScript (0 erros)
- [x] Testar Vitest (6 testes passando)


## Módulos Compras e Vendas
- [x] Criar tabela `purchases` no banco de dados
- [x] Criar router tRPC purchases (list, create)
- [x] Criar router tRPC delete para products
- [x] Criar página Purchases.tsx com formulário e histórico
- [x] Adicionar funcionalidade delete em Products.tsx
- [x] Adicionar rotas /purchases em App.tsx
- [x] Adicionar itens "Compras" e "Vendas" ao menu DashboardLayout
- [x] Testar e validar (TypeScript 0 erros, Vitest 6 testes passando)


## Módulo de Configurações
- [x] Criar tabelas de configuração, roles, permissões e auditoria no banco
- [x] Criar routers tRPC para settings (getConfig, updateConfig, roles, permissões)
- [x] Criar página Settings.tsx com 5 abas (Geral, Tema, Usuários, Permissões, Auditoria)
- [x] Adicionar rota /settings e item de menu "Configurações"
- [x] Testar e validar (TypeScript 0 erros, Vitest 6 testes passando)


## Módulo de Fornecedores
- [x] Criar tabela `suppliers` com dados de contato e endereço
- [x] Criar tabela de relação `productSuppliers` (produto → fornecedor)
- [x] Gerar migration e aplicar SQL
- [x] Criar routers tRPC para fornecedores (list, create, update, delete, getProductSuppliers)
- [x] Criar página Suppliers.tsx com tabela e CRUD completo
- [x] Integrar dropdown de fornecedores em Purchases.tsx
- [x] Adicionar rota /suppliers em App.tsx
- [x] Adicionar item "Fornecedores" ao menu DashboardLayout com ícone Truck
- [x] Testar e validar (TypeScript 0 erros, Vitest 6 testes passando)


## Soft Delete de Produtos
- [x] Adicionar coluna `isActive` (boolean, default true) na tabela `products`
- [x] Gerar migration e aplicar SQL via webdev_execute_sql
- [x] Criar router tRPC `products.deactivate` (soft delete)
- [x] Atualizar router `products.list` para filtrar apenas produtos ativos
- [x] Atualizar router `products.update` para permitir reativar produtos
- [x] Atualizar UI Products.tsx: botão "Desativar" em vez de "Excluir", modal de confirmação
- [x] Adicionar coluna de status (Ativo/Inativo) na tabela de produtos
- [x] Implementar testes Vitest para soft delete
- [x] Testar integridade: vendas/compras continuam acessíveis mesmo com produto desativado

## Edição de Produtos em Compras
- [x] Adicionar botão "Editar" em cada linha de produto no dropdown de Compras.tsx
- [x] Criar dialog de edição rápida com campos: nome, preço de custo, preço de venda, estoque
- [x] Integrar com router `products.update` para salvar alterações
- [x] Atualizar dropdown de produtos após edição
- [x] Adicionar feedback visual (toast) após edição bem-sucedida
- [x] Implementar testes Vitest para edição em compras

## Checkpoint Final
- [x] Salvar checkpoint com soft delete + edição em compras


## Edição de Registros de Compra
- [x] Criar router tRPC `purchases.update` para atualizar registro de compra
- [x] Adicionar dialog de edição de compra com campos: produto, quantidade, preço unitário, fornecedor, canal, data
- [x] Adicionar botão "Editar" em cada linha da tabela de histórico de compras
- [x] Integrar edição com atualização de estoque (se quantidade mudar)
- [x] Adicionar feedback visual (toast) após edição bem-sucedida
- [x] Implementar testes Vitest para edição de compra
- [x] Salvar checkpoint com edição de compras


## Correção - Botão de Atualizar em Controle de Vendas
- [x] Adicionar estado de loading ao botão de refresh
- [x] Implementar Promise.all para aguardar ambos os refetch (sales e products)
- [x] Adicionar animação de spin ao ícone durante carregamento
- [x] Desabilitar botão enquanto está atualizando
- [x] Mostrar feedback visual "Atualizando..." no texto do botão


## Sistema de Recibo de Vendas
- [x] Criar componente ReceiptModal.tsx com exibição de recibo
- [x] Integrar ReceiptModal em Sales.tsx após finalização de venda
- [x] Implementar download de recibo em HTML
- [x] Testar fluxo completo: venda → recibo → download
- [x] Validar que carrinho é limpo após venda
- [x] Validar que estoque é atualizado corretamente


## Melhorias no Sistema de Recibo
- [x] Criar tabela `receipts` no banco com numeração sequencial persistente
- [x] Adicionar campo de observações na venda (notes/obs do cliente)
- [x] Criar router tRPC para recibos (create, list, getByNumber)
- [x] Integrar criação de recibo no fluxo de finalização de venda
- [x] Adicionar botão de impressão direta (window.print) no ReceiptModal
- [x] Adicionar campo de observações no carrinho/finalização de venda
- [x] Exibir observações no recibo
- [x] Testes Vitest para novas funcionalidades (34 testes passando)


## Análise Completa - Melhorias Identificadas
- [x] Bloquear venda de produtos com estoque 0 (não permitir adicionar ao carrinho)
- [x] Produtos com estoque 0: visual diferenciado na página de vendas (opacidade, badge "Sem estoque")
- [x] Criar página de Histórico de Recibos com busca por número
- [x] Adicionar link "Recibos" no menu lateral (sidebar)
- [x] No Controle de Vendas: corrigir filtro de categoria (bug: não estava aplicando)
- [x] Na página de vendas: toggle para mostrar/ocultar produtos sem estoque
- [x] Melhorar feedback visual ao adicionar item ao carrinho (toast de sucesso/erro)

## Reformulação do Módulo de Compras
- [x] Remover botão "Novo Produto" isolado da página de compras
- [x] Remover campo "canal" do formulário de compras
- [x] Criar painel detalhado "Nova Compra" com múltiplos produtos na mesma compra
- [x] Campo de produto com busca/pesquisa (autocomplete)
- [x] Cadastro inline de novo produto diretamente no painel de compra
- [x] Cadastro inline de novo fornecedor diretamente no painel de compra
- [x] Seleção de categoria no cadastro inline de produto (categorias pré-definidas)
- [x] Adicionar upload de arquivo (PDF/XML/XLSX) na importação de nota fiscal
- [x] Botão de importação de nota fiscal/planilha
- [x] Algoritmo inteligente (LLM) para extrair itens da nota fiscal
- [x] Algoritmo identifica categoria automaticamente
- [x] Algoritmo extrai dados do fornecedor e cadastra automaticamente
- [x] Cadastrar todos os produtos da compra no estoque automaticamente
