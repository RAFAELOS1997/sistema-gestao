// Assistente de IA do painel admin — usa a API do Google Gemini com
// Function Calling pra ler e ALTERAR dados reais do sistema (produtos,
// estoque, preços, parceiros) a partir de uma conversa em texto.
//
// Ferramentas de LEITURA (listar/resumo) executam na hora. Ferramentas de
// ESCRITA (que mudam preço/estoque/status) NUNCA executam sozinhas — a IA
// só monta a proposta, e ela fica pendente até o usuário clicar em
// "Confirmar" na tela (ver `executeConfirmedAction`, chamada pelo endpoint
// separado `aiAssistant.confirmAction`). Toda escrita confirmada também
// grava uma linha em auditLog (quem/quando/antes/depois).
//
// Usa fetch puro na API REST do Gemini (sem instalar o SDK oficial) —
// mesmo padrão do resto do projeto (InfinitePay, Nominatim, Overpass etc.),
// menos risco de quebrar o build da Hostinger com uma dependência nova.

import { ENV } from "./env";
import {
  listProducts,
  updateProduct,
  getDashboardKPIs,
  listTerreiros,
  updateTerreiro,
  createAuditLog,
} from "../db";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, any> } }
  | { functionResponse: { name: string; response: Record<string, any> } };

type GeminiContent = { role: "user" | "model" | "function"; parts: GeminiPart[] };

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "listarProdutos",
        description: "Lista produtos do estoque, com preço de custo, preço de venda e quantidade em estoque. Pode filtrar por nome.",
        parameters: {
          type: "OBJECT",
          properties: {
            filtroNome: { type: "STRING", description: "Filtra produtos cujo nome contém esse texto (opcional)" },
          },
        },
      },
      {
        name: "atualizarProduto",
        description: "Propõe alterar o preço de venda e/ou a quantidade em estoque de UM produto existente. Preços em reais (ex: 25.90). Não executa sozinho — fica pendente de confirmação do usuário.",
        parameters: {
          type: "OBJECT",
          properties: {
            produtoId: { type: "INTEGER", description: "Id do produto (obtido via listarProdutos)" },
            novoPrecoVenda: { type: "NUMBER", description: "Novo preço de venda em reais, se for alterar" },
            novoEstoque: { type: "INTEGER", description: "Nova quantidade em estoque, se for alterar" },
          },
          required: ["produtoId"],
        },
      },
      {
        name: "resumoVendas",
        description: "Resumo de vendas, faturamento, lucro e estoque baixo dos últimos N dias.",
        parameters: {
          type: "OBJECT",
          properties: {
            dias: { type: "INTEGER", description: "Quantidade de dias pra trás (padrão 30)" },
          },
        },
      },
      {
        name: "listarTerreiros",
        description: "Lista os terreiros parceiros cadastrados, com status ativo/inativo.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "atualizarStatusTerreiro",
        description: "Propõe ativar ou desativar um terreiro parceiro. Não executa sozinho — fica pendente de confirmação do usuário.",
        parameters: {
          type: "OBJECT",
          properties: {
            terreiroId: { type: "INTEGER" },
            ativo: { type: "BOOLEAN" },
          },
          required: ["terreiroId", "ativo"],
        },
      },
    ],
  },
];

const centsToReais = (cents: number) => Math.round(cents) / 100;
const reaisToCents = (reais: number) => Math.round(reais * 100);

// Ferramentas que alteram dados — nunca executadas direto pelo turno do
// chat, só propostas. `executeConfirmedAction` é a única função que
// realmente grava no banco pra essas.
const WRITE_TOOLS = new Set(["atualizarProduto", "atualizarStatusTerreiro"]);

async function executeReadTool(name: string, args: Record<string, any>): Promise<Record<string, any>> {
  switch (name) {
    case "listarProdutos": {
      const all = await listProducts();
      const filtro = (args.filtroNome ?? "").toString().trim().toLowerCase();
      const filtered = filtro ? all.filter((p) => p.name.toLowerCase().includes(filtro)) : all;
      return {
        produtos: filtered.slice(0, 50).map((p) => ({
          id: p.id,
          nome: p.name,
          categoria: p.category,
          precoCusto: centsToReais(p.costPrice),
          precoVenda: centsToReais(p.salePrice),
          estoque: p.currentStock,
          estoqueMinimo: p.minimumStock,
        })),
        total: filtered.length,
      };
    }

    case "resumoVendas": {
      const dias = Number(args.dias) || 30;
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - dias * 24 * 60 * 60 * 1000);
      const kpis = await getDashboardKPIs(startDate, endDate);
      return {
        periodoDias: dias,
        totalVendas: kpis.salesCount,
        faturamento: centsToReais(kpis.totalRevenue),
        lucro: centsToReais(kpis.totalProfit),
        margemLucro: kpis.profitMargin,
        produtosComEstoqueBaixo: kpis.lowStockAlerts,
      };
    }

    case "listarTerreiros": {
      const all = await listTerreiros(true);
      return {
        terreiros: all.map((t) => ({ id: t.id, nome: t.name, usuario: t.username, ativo: !!t.isActive })),
      };
    }

    default:
      return { erro: `Ferramenta desconhecida: ${name}` };
  }
}

// Descrição em texto da proposta, mostrada tanto pro modelo (na resposta da
// função) quanto na tela pro usuário decidir se confirma.
async function describeProposedAction(name: string, args: Record<string, any>): Promise<{ ok: boolean; descricao: string }> {
  if (name === "atualizarProduto") {
    const produtoId = Number(args.produtoId);
    const produto = produtoId ? (await listProducts()).find((p) => p.id === produtoId) : null;
    if (!produto) return { ok: false, descricao: `Produto ${args.produtoId} não encontrado` };
    const partes: string[] = [];
    if (args.novoPrecoVenda != null) partes.push(`preço de venda pra R$ ${Number(args.novoPrecoVenda).toFixed(2)}`);
    if (args.novoEstoque != null) partes.push(`estoque pra ${args.novoEstoque} unidade(s)`);
    if (partes.length === 0) return { ok: false, descricao: "Nada pra alterar foi informado" };
    return { ok: true, descricao: `Alterar "${produto.name}": ${partes.join(" e ")}` };
  }
  if (name === "atualizarStatusTerreiro") {
    const terreiroId = Number(args.terreiroId);
    const terreiro = terreiroId ? (await listTerreiros(true)).find((t) => t.id === terreiroId) : null;
    if (!terreiro) return { ok: false, descricao: `Terreiro ${args.terreiroId} não encontrado` };
    return { ok: true, descricao: `${args.ativo ? "Ativar" : "Desativar"} o terreiro "${terreiro.name}"` };
  }
  return { ok: false, descricao: `Ferramenta desconhecida: ${name}` };
}

// Executa de verdade uma ação de escrita já CONFIRMADA pelo usuário na
// tela — é a única função deste módulo que grava no banco.
export async function executeConfirmedAction(
  tool: string,
  args: Record<string, any>,
  adminUserId: number
): Promise<Record<string, any>> {
  if (tool === "atualizarProduto") {
    const produtoId = Number(args.produtoId);
    if (!produtoId) return { erro: "produtoId inválido" };
    const before = (await listProducts()).find((p) => p.id === produtoId);
    if (!before) return { erro: `Produto ${produtoId} não encontrado` };

    const updates: Record<string, any> = {};
    if (args.novoPrecoVenda != null) updates.salePrice = reaisToCents(Number(args.novoPrecoVenda));
    if (args.novoEstoque != null) updates.currentStock = Math.round(Number(args.novoEstoque));
    if (Object.keys(updates).length === 0) return { erro: "Nada pra alterar foi informado" };

    await updateProduct(produtoId, updates);
    await createAuditLog({
      userId: adminUserId,
      action: "ai_assistant_update_product",
      module: "products",
      description: `Assistente IA alterou "${before.name}" (id ${produtoId}), confirmado pelo usuário`,
      changes: JSON.stringify({ antes: { precoVenda: centsToReais(before.salePrice), estoque: before.currentStock }, depois: args }),
    });
    return { sucesso: true, produto: before.name, alteracoes: args };
  }

  if (tool === "atualizarStatusTerreiro") {
    const terreiroId = Number(args.terreiroId);
    if (!terreiroId) return { erro: "terreiroId inválido" };
    const ativo = !!args.ativo;
    const before = (await listTerreiros(true)).find((t) => t.id === terreiroId);
    if (!before) return { erro: `Terreiro ${terreiroId} não encontrado` };

    await updateTerreiro(terreiroId, { isActive: ativo ? 1 : 0 });
    await createAuditLog({
      userId: adminUserId,
      action: "ai_assistant_update_terreiro",
      module: "terreiros",
      description: `Assistente IA ${ativo ? "ativou" : "desativou"} "${before.name}" (id ${terreiroId}), confirmado pelo usuário`,
      changes: JSON.stringify({ ativo }),
    });
    return { sucesso: true, terreiroId, ativo };
  }

  return { erro: `Ferramenta desconhecida: ${tool}` };
}

export type AssistantMessage = { role: "user" | "model"; text: string };

export type PendingAction = { tool: string; args: Record<string, any>; descricao: string };

export type AssistantTurnResult = {
  reply: string;
  actionsPerformed: { tool: string; args: Record<string, any>; result: Record<string, any> }[];
  pendingActions: PendingAction[];
};

const SYSTEM_INSTRUCTION = `Você é o assistente de IA do painel administrativo da Toca da Pantera, uma loja de artigos umbandistas/religiosos. Você pode CONSULTAR dados reais do sistema livremente (produtos, vendas, terreiros). Para ALTERAR algo (preço, estoque, status de terreiro), você só pode PROPOR a alteração através da ferramenta — ela nunca executa sozinha, sempre fica pendente até o usuário confirmar clicando num botão na tela. Depois de propor, avise o usuário que a ação está aguardando confirmação dele na tela. Se a instrução for ambígua (ex: mais de um produto com nome parecido), pergunte antes de propor. Responda sempre em português do Brasil, de forma direta e sem jargão técnico — o usuário (Rafael) não é técnico.`;

export async function runAssistantTurn(
  history: AssistantMessage[],
  userMessage: string,
  _adminUserId: number
): Promise<AssistantTurnResult> {
  if (!ENV.geminiApiKey) {
    throw new Error("Assistente de IA não configurado — falta a chave GEMINI_API_KEY.");
  }

  const contents: GeminiContent[] = [
    ...history.map((m) => ({ role: m.role, parts: [{ text: m.text }] } as GeminiContent)),
    { role: "user", parts: [{ text: userMessage }] },
  ];

  const actionsPerformed: AssistantTurnResult["actionsPerformed"] = [];
  const pendingActions: PendingAction[] = [];
  const MAX_TOOL_ROUNDS = 5; // evita loop infinito se o modelo insistir em chamar ferramentas

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await fetch(`${GEMINI_URL}?key=${ENV.geminiApiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents,
        tools: TOOLS,
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini falhou: ${response.status} — ${errorText}`);
    }

    const data = await response.json();
    const candidateParts: GeminiPart[] = data?.candidates?.[0]?.content?.parts ?? [];
    const functionCallPart = candidateParts.find((p): p is { functionCall: { name: string; args: Record<string, any> } } => "functionCall" in p);

    if (!functionCallPart) {
      const text = candidateParts
        .filter((p): p is { text: string } => "text" in p)
        .map((p) => p.text)
        .join("\n")
        .trim();
      return { reply: text || "Não entendi — pode reformular?", actionsPerformed, pendingActions };
    }

    const { name, args } = functionCallPart.functionCall;
    const safeArgs = args ?? {};

    let result: Record<string, any>;
    if (WRITE_TOOLS.has(name)) {
      const { ok, descricao } = await describeProposedAction(name, safeArgs);
      if (ok) pendingActions.push({ tool: name, args: safeArgs, descricao });
      result = ok
        ? { status: "aguardando_confirmacao", descricao }
        : { erro: descricao };
    } else {
      result = await executeReadTool(name, safeArgs);
    }
    actionsPerformed.push({ tool: name, args: safeArgs, result });

    contents.push({ role: "model", parts: [functionCallPart] });
    contents.push({ role: "function", parts: [{ functionResponse: { name, response: result } }] });
  }

  return {
    reply: "Consultei e montei algumas propostas de alteração — confira e confirme abaixo.",
    actionsPerformed,
    pendingActions,
  };
}
