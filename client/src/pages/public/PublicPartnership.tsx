import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DecorativeDivider } from "@/components/DecorativeDivider";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { WHATSAPP_LINK } from "@/lib/contact";
import {
  Handshake,
  TrendingUp,
  Users,
  Medal,
  CheckCircle2,
  MessageCircle,
  Sparkles,
  PackageCheck,
  Percent,
  CalendarClock,
} from "lucide-react";

const TIERS = [
  {
    name: "Cobre",
    percent: 10,
    color: "text-amber-700 bg-amber-700/10 border-amber-700/30",
    criteria: "Assim que se cadastra como parceiro",
  },
  {
    name: "Bronze",
    percent: 12,
    color: "text-orange-500 bg-orange-500/10 border-orange-500/30",
    criteria: "Ao fazer o primeiro pedido",
  },
  {
    name: "Prata",
    percent: 15,
    color: "text-slate-300 bg-slate-400/10 border-slate-400/30",
    criteria: "Pedindo pelo menos 1x por mês, 3 meses seguidos",
  },
  {
    name: "Ouro",
    percent: 18,
    color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30",
    criteria: "Mais de R$ 300 em pedidos nos últimos 3 meses",
  },
  {
    name: "Diamante",
    percent: 22,
    color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
    criteria: "Mais de R$ 500 em pedidos nos últimos 3 meses",
  },
];

const EXAMPLE_SPEND = 40000; // R$ 400,00 em centavos

export default function PublicPartnership() {
  const [form, setForm] = useState({ terreiroName: "", contactName: "", phone: "", city: "", notes: "" });
  const [submitted, setSubmitted] = useState(false);

  const applyMutation = trpc.partnerApplications.create.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.terreiroName.trim() || !form.contactName.trim() || !form.phone.trim()) {
      toast.error("Preencha nome do terreiro, seu nome e telefone");
      return;
    }
    applyMutation.mutate({
      terreiroName: form.terreiroName.trim(),
      contactName: form.contactName.trim(),
      phone: form.phone.trim(),
      city: form.city.trim() || undefined,
      notes: form.notes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-12 sm:space-y-16 pb-8">
      {/* Hero da página */}
      <div className="text-center space-y-4 pt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs font-semibold">
          <Handshake className="w-3.5 h-3.5" />
          Programa de Parceria
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground max-w-2xl mx-auto">
          Seu terreiro pagando <span className="text-accent">menos</span>, comprando junto com uma rede inteira
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
          Quanto mais terreiros parceiros pedindo com a gente, maior o volume de compra da Toca — e esse ganho a
          gente devolve pra vocês em forma de desconto. Cadastre seu terreiro e comece a economizar hoje mesmo.
        </p>
      </div>

      <DecorativeDivider className="max-w-sm mx-auto" />

      {/* Como funciona */}
      <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <TrendingUp className="w-8 h-8 text-accent mx-auto" />
            <h3 className="font-semibold text-foreground">Poder de compra em rede</h3>
            <p className="text-sm text-muted-foreground">
              Cada pedido novo de cada terreiro parceiro fortalece o volume de compra da Toca com o fornecedor —
              e isso é o que sustenta descontos cada vez maiores pra todo mundo.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <PackageCheck className="w-8 h-8 text-accent mx-auto" />
            <h3 className="font-semibold text-foreground">Pedido direto pelo site</h3>
            <p className="text-sm text-muted-foreground">
              Sem precisar ir até a loja: acesse o catálogo, monte seu pedido com o preço do seu plano já aplicado,
              e a gente confirma com você.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <Sparkles className="w-8 h-8 text-accent mx-auto" />
            <h3 className="font-semibold text-foreground">Seu plano evolui sozinho</h3>
            <p className="text-sm text-muted-foreground">
              Quanto mais você pede, maior o seu desconto — automaticamente, sem precisar renegociar nada.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Escada de planos */}
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">5 planos, um caminho só de subida</h2>
          <p className="text-muted-foreground text-sm mt-1">Todo parceiro começa no Cobre — o resto é com você</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {TIERS.map((tier) => (
            <div key={tier.name} className={`rounded-xl border p-4 flex flex-col items-center text-center gap-2 ${tier.color}`}>
              <Medal className="w-6 h-6" />
              <p className="font-bold text-foreground">{tier.name}</p>
              <p className="text-2xl font-extrabold">{tier.percent}%</p>
              <p className="text-[11px] text-muted-foreground leading-snug">{tier.criteria}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
          <CalendarClock className="w-3.5 h-3.5" />
          Os planos são reavaliados a cada 3 meses, com base nos seus últimos 3 meses de pedidos
        </p>
      </div>

      <DecorativeDivider className="max-w-sm mx-auto" />

      {/* Exemplo didático */}
      <div className="max-w-3xl mx-auto">
        <Card className="border-accent/30">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-foreground">Na prática, quanto isso economiza?</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Imagine que seu terreiro compra, em média, <strong className="text-foreground">R$ 400,00 por mês</strong>{" "}
              em guias, velas, ervas e itens de gira. Veja a diferença que o seu plano faz:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { name: "Cobre", percent: 10 },
                { name: "Ouro", percent: 18 },
                { name: "Diamante", percent: 22 },
              ].map((t) => {
                const paid = Math.round(EXAMPLE_SPEND * (1 - t.percent / 100));
                const savedMonth = EXAMPLE_SPEND - paid;
                return (
                  <div key={t.name} className="rounded-lg bg-background border border-border p-3 text-center">
                    <p className="text-xs font-semibold text-accent">{t.name} · {t.percent}%</p>
                    <p className="text-lg font-bold text-foreground mt-1">R$ {(paid / 100).toFixed(2)}</p>
                    <p className="text-[11px] text-muted-foreground">em vez de R$ 400,00</p>
                    <p className="text-xs text-green-500 font-medium mt-1">
                      economiza R$ {(savedMonth / 100).toFixed(2)}/mês
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      R$ {((savedMonth * 12) / 100).toFixed(2)} por ano
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              E esse mesmo pedido de R$ 400 já é o suficiente pra virar Ouro no ciclo seguinte — o desconto de hoje
              vira o desconto maior de amanhã.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rede de parceiros */}
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <Users className="w-8 h-8 text-accent mx-auto" />
        <h2 className="text-lg sm:text-xl font-bold text-foreground">Você não compra sozinho — você compra com a rede</h2>
        <p className="text-sm text-muted-foreground">
          Cada terreiro que entra na parceria soma força ao pedido coletivo que a Toca faz com o fornecedor. É esse
          volume que abre espaço pra negociar condições melhores — e é isso que sustenta os planos de desconto
          existirem e crescerem com o tempo. Quanto maior a rede, mais forte fica pra todo mundo.
        </p>
      </div>

      <DecorativeDivider className="max-w-sm mx-auto" />

      {/* Regras resumidas */}
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h2 className="text-lg font-bold text-foreground">Como funciona, resumido</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                "Se cadastrou como parceiro → já começa no Cobre, com 10% de desconto.",
                "Fez o primeiro pedido → sobe pra Bronze.",
                "Pediu ao menos uma vez por mês, 3 meses seguidos → sobe pra Prata.",
                "Gastou mais de R$ 300 em pedidos nos últimos 3 meses → sobe pra Ouro.",
                "Gastou mais de R$ 500 em pedidos nos últimos 3 meses → sobe pra Diamante.",
                "A cada 3 meses o sistema reavalia — quanto mais você pede, mais alto o plano fica.",
              ].map((rule, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  {rule}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground pt-1 border-t border-border">
              Conta tudo que você pedir pela tela "Fazer Pedidos" — tanto o catálogo do fornecedor quanto o
              estoque da loja. Compras feitas direto no balcão não entram nessa conta.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* CTA / Formulário */}
      <div className="max-w-xl mx-auto" id="quero-ser-parceiro">
        <Card className="border-accent/40">
          <CardContent className="pt-6 space-y-4">
            {submitted ? (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
                <h2 className="text-lg font-bold text-foreground">Recebemos seu interesse!</h2>
                <p className="text-sm text-muted-foreground">
                  Vamos entrar em contato pelo telefone informado pra confirmar seu cadastro como parceiro Cobre.
                </p>
                <a
                  href={WHATSAPP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
                >
                  <MessageCircle className="w-4 h-4" />
                  Ou fale com a gente agora pelo WhatsApp
                </a>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <h2 className="text-xl font-bold text-foreground">Quero ser parceiro</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Preencha rapidinho e a gente entra em contato pra ativar seu acesso
                  </p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <Label htmlFor="terreiroName">Nome do terreiro/centro</Label>
                    <Input
                      id="terreiroName"
                      value={form.terreiroName}
                      onChange={(e) => setForm({ ...form, terreiroName: e.target.value })}
                      placeholder="Ex: Terreiro Ilê Axé..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="contactName">Seu nome</Label>
                      <Input
                        id="contactName"
                        value={form.contactName}
                        onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Telefone (WhatsApp)</Label>
                      <Input
                        id="phone"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="city">Cidade (opcional)</Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="Ribeirão Preto"
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Quer contar mais alguma coisa? (opcional)</Label>
                    <Textarea
                      id="notes"
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Ex: quantos consulentes atende, o que costuma comprar..."
                      rows={2}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                    disabled={applyMutation.isPending}
                  >
                    {applyMutation.isPending ? "Enviando..." : "Quero ser parceiro"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" />
                    Prefere mais rápido?{" "}
                    <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      Chama no WhatsApp
                    </a>
                  </p>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
