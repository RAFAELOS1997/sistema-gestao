import { useEffect, useRef, useState } from "react";
import { Bot, Send, User, Wrench, AlertTriangle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type PendingAction = { tool: string; args: Record<string, any>; descricao: string };
type PendingActionState = PendingAction & { key: string; status: "pendente" | "confirmando" | "confirmada" | "recusada" | "erro" };

type ChatMessage = {
  role: "user" | "model";
  text: string;
  actions?: { tool: string; args: Record<string, any>; result: Record<string, any> }[];
  pending?: PendingActionState[];
};

const TOOL_LABELS: Record<string, string> = {
  listarProdutos: "Consultou produtos",
  atualizarProduto: "Propôs alterar um produto",
  resumoVendas: "Consultou resumo de vendas",
  listarTerreiros: "Consultou terreiros parceiros",
  atualizarStatusTerreiro: "Propôs alterar status de um terreiro",
};

export default function AiAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const configQuery = trpc.aiAssistant.config.useQuery();
  const chatMutation = trpc.aiAssistant.chat.useMutation();
  const confirmMutation = trpc.aiAssistant.confirmAction.useMutation();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || chatMutation.isPending) return;

    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");

    try {
      const result = await chatMutation.mutateAsync({ message: text, history });
      const pending: PendingActionState[] = result.pendingActions.map((p: PendingAction, i: number) => ({
        ...p,
        key: `${Date.now()}-${i}`,
        status: "pendente",
      }));
      setMessages((prev) => [...prev, { role: "model", text: result.reply, actions: result.actionsPerformed, pending }]);
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao falar com o assistente");
      setMessages((prev) => [...prev, { role: "model", text: `Deu erro: ${error?.message ?? "desconhecido"}` }]);
    }
  };

  const updatePendingStatus = (msgIndex: number, key: string, status: PendingActionState["status"]) => {
    setMessages((prev) =>
      prev.map((m, i) => (i !== msgIndex ? m : { ...m, pending: m.pending?.map((p) => (p.key === key ? { ...p, status } : p)) }))
    );
  };

  const handleConfirm = async (msgIndex: number, action: PendingActionState) => {
    updatePendingStatus(msgIndex, action.key, "confirmando");
    try {
      const result = await confirmMutation.mutateAsync({ tool: action.tool, args: action.args });
      if (result?.erro) {
        toast.error(result.erro);
        updatePendingStatus(msgIndex, action.key, "erro");
      } else {
        toast.success("Alteração aplicada!");
        updatePendingStatus(msgIndex, action.key, "confirmada");
      }
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao confirmar");
      updatePendingStatus(msgIndex, action.key, "erro");
    }
  };

  const handleDismiss = (msgIndex: number, key: string) => {
    updatePendingStatus(msgIndex, key, "recusada");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (configQuery.data && !configQuery.data.configured) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-3">
        <Bot className="w-12 h-12 text-muted-foreground mx-auto opacity-40" />
        <h1 className="text-xl font-bold text-foreground">Assistente de IA ainda não configurado</h1>
        <p className="text-sm text-muted-foreground">
          Falta cadastrar a chave GEMINI_API_KEY nas variáveis de ambiente da Hostinger. Gere uma gratuitamente
          em aistudio.google.com e me peça pra configurar assim que tiver ela em mãos.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)] sm:h-[calc(100vh-6rem)]">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-11 w-11 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
          <Bot className="h-6 w-6 text-accent" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">Assistente de IA</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Conversa que consulta o sistema e propõe alterações — nada é gravado sem você confirmar
          </p>
        </div>
      </div>

      <div className="mb-3 flex items-start gap-2 text-xs text-accent bg-accent/10 border border-accent/30 rounded-lg px-3 py-2">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>Alterações (preço, estoque, status de terreiro) só acontecem depois de você clicar em "Confirmar". Toda confirmação fica registrada no histórico de auditoria.</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">
            Pergunte algo, ex: "quais produtos estão com estoque baixo?" ou "muda o preço da vela branca pra 3 reais"
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "model" && (
              <div className="h-7 w-7 rounded-full bg-accent/15 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-accent" />
              </div>
            )}
            <div className={`max-w-[80%] space-y-1.5 ${m.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
              <div
                className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                  m.role === "user" ? "bg-accent text-accent-foreground" : "bg-card border border-border text-foreground"
                }`}
              >
                {m.text}
              </div>
              {m.actions && m.actions.length > 0 && (
                <div className="space-y-1">
                  {m.actions.map((a, j) => (
                    <div key={j} className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-background border border-border rounded px-2 py-1">
                      <Wrench className="w-3 h-3 shrink-0" />
                      {TOOL_LABELS[a.tool] ?? a.tool}
                      {a.result?.erro && <span className="text-red-400">— {a.result.erro}</span>}
                    </div>
                  ))}
                </div>
              )}
              {m.pending && m.pending.length > 0 && (
                <div className="space-y-2 w-full">
                  {m.pending.map((p) => (
                    <div key={p.key} className="rounded-lg border border-accent/30 bg-accent/5 p-2.5 space-y-2">
                      <p className="text-xs text-foreground font-medium">{p.descricao}</p>
                      {p.status === "pendente" && (
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-xs bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => handleConfirm(i, p)}>
                            <Check className="w-3 h-3 mr-1" /> Confirmar
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleDismiss(i, p.key)}>
                            <X className="w-3 h-3 mr-1" /> Recusar
                          </Button>
                        </div>
                      )}
                      {p.status === "confirmando" && <p className="text-xs text-muted-foreground">Aplicando...</p>}
                      {p.status === "confirmada" && <p className="text-xs text-green-400 flex items-center gap-1"><Check className="w-3 h-3" /> Aplicado</p>}
                      {p.status === "recusada" && <p className="text-xs text-muted-foreground flex items-center gap-1"><X className="w-3 h-3" /> Recusado, nada foi alterado</p>}
                      {p.status === "erro" && <p className="text-xs text-red-400">Erro ao aplicar</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {m.role === "user" && (
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
        {chatMutation.isPending && (
          <div className="flex gap-2 justify-start">
            <div className="h-7 w-7 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-accent animate-pulse" />
            </div>
            <div className="rounded-lg px-3 py-2 text-sm bg-card border border-border text-muted-foreground">
              Pensando...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <Card className="mt-3">
        <CardContent className="p-2 flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escreva sua pergunta ou instrução..."
            rows={1}
            className="resize-none min-h-9"
          />
          <Button
            size="icon"
            className="bg-accent text-accent-foreground hover:bg-accent/90 shrink-0"
            disabled={!input.trim() || chatMutation.isPending}
            onClick={handleSend}
          >
            <Send className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
