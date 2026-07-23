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
  Store,
  Wallet,
  MapPin,
  Rocket,
  Moon,
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
      <div className="text-center space-y-5 pt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#c9a961]/10 border border-[#c9a961]/30 text-[#c9a961] text-xs font-semibold">
          <Handshake className="w-3.5 h-3.5" />
          Programa de Parceria — vagas abertas agora
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground max-w-2xl mx-auto">
          Todo mês que seu terreiro compra sem parceria, é dinheiro que{" "}
          <span className="text-[#c9a961]">fica na mesa</span>
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
          Terreiro parceiro paga até <strong className="text-foreground">22% mais barato</strong> em guias, velas,
          ervas e tudo mais — e pode até ganhar uma bancada de produtos de graça pra vender no seu espaço. Sem
          mensalidade, sem compromisso, sem pedido mínimo pra começar.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
          <a href="#quero-ser-parceiro">
            <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
              Quero economizar agora
            </Button>
          </a>
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
          >
            <MessageCircle className="w-4 h-4" />
            ou chama no WhatsApp
          </a>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-accent" /> Cadastro leva 2 minutos
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-accent" /> Sem mensalidade
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-accent" /> Sem compromisso de compra
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-3">
          {[
            { name: "Exu", colors: ["#8b1a1a", "#111111"] },
            { name: "Pombagira", colors: ["#b5124e", "#8b1a1a"] },
            { name: "Caboclo", colors: ["#2e6b3e", "#6b4a2e"] },
            { name: "Malandragem", colors: ["#e6e6e6", "#8b1a1a"] },
            { name: "Orixás", colors: ["#f5f5f0", "#c9a961"] },
          ].map((e) => (
            <span key={e.name} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="flex h-2.5 w-2.5 rounded-full overflow-hidden shrink-0">
                <span className="flex-1" style={{ backgroundColor: e.colors[0] }} />
                <span className="flex-1" style={{ backgroundColor: e.colors[1] }} />
              </span>
              {e.name}
            </span>
          ))}
        </div>
      </div>

      <DecorativeDivider className="max-w-sm mx-auto" />

      {/* Como funciona */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
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
            <Moon className="w-8 h-8 text-accent mx-auto" />
            <h3 className="font-semibold text-foreground">Entrega no horário da sua gira</h3>
            <p className="text-sm text-muted-foreground">
              A Toca entrega fora do horário comercial — pra não bater com o horário de atendimento do seu
              terreiro. Um diferencial que só a gente oferece.
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

      <DecorativeDivider className="max-w-sm mx-auto" />

      {/* Comodato / stand no terreiro */}
      <div className="max-w-4xl mx-auto">
        <Card className="border-accent/40 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent pointer-events-none" />
          <CardContent className="pt-6 relative space-y-5">
            <div className="flex items-center gap-2">
              <Store className="w-6 h-6 text-accent" />
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/15 text-accent text-[11px] font-semibold">
                <MapPin className="w-3 h-3" />
                Por enquanto só em Ribeirão Preto e região
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
              Tenha uma bancada de produtos da Toca dentro do seu terreiro — <span className="text-accent">sem gastar um real</span>
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              É o comodato: a gente leva os produtos até o seu terreiro e deixa lá, sem cobrar nada na entrega. Você
              vende nos dias de gira, atendimento ou consulta, e só nos repassa o valor combinado de cada item
              vendido — o que não vender, a gente busca de volta, sem custo nenhum pra você.
            </p>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="flex flex-col items-center text-center gap-1.5 p-3">
                <Wallet className="w-6 h-6 text-accent" />
                <p className="font-semibold text-foreground text-sm">Você escolhe o preço</p>
                <p className="text-xs text-muted-foreground">
                  A gente combina um valor por item. Você vende pelo preço que quiser — a diferença é seu lucro,
                  100%.
                </p>
              </div>
              <div className="flex flex-col items-center text-center gap-1.5 p-3">
                <PackageCheck className="w-6 h-6 text-accent" />
                <p className="font-semibold text-foreground text-sm">Zero risco, zero investimento</p>
                <p className="text-xs text-muted-foreground">
                  Não paga nada na entrega. Só acerta o que vendeu. O que sobrar, devolve — sem dívida, sem prejuízo.
                </p>
              </div>
              <div className="flex flex-col items-center text-center gap-1.5 p-3">
                <Rocket className="w-6 h-6 text-accent" />
                <p className="font-semibold text-foreground text-sm">Plano Bronze na hora</p>
                <p className="text-xs text-muted-foreground">
                  Ao colocar sua primeira bancada de comodato, seu terreiro já sobe pra Bronze automaticamente
                  (ou fica no plano que já tiver, se for maior).
                </p>
              </div>
            </div>

            <div className="bg-background rounded-lg border border-border p-4">
              <p className="text-sm text-foreground font-medium mb-1">Exemplo bem simples:</p>
              <p className="text-sm text-muted-foreground">
                A Toca deixa 10 guias com você, combinado R$ 15,00 cada — R$ 150,00 no total. Você vende cada uma
                por R$ 25,00 pros seus consulentes: R$ 250,00 arrecadados. Você repassa os R$ 150,00 combinados, e
                fica com <strong className="text-accent">R$ 100,00 de lucro líquido</strong> — sem ter gasto nada
                do próprio bolso pra começar.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <DecorativeDivider className="max-w-sm mx-auto" />

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
              Conta tudo que você pedir pela tela "Gerar Pedidos" do Portal do Parceiro — tanto o catálogo do
              fornecedor quanto o estoque da loja. Compras feitas direto no balcão não entram nessa conta.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Objeções / FAQ */}
      <div className="max-w-2xl mx-auto space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground text-center">Ainda com dúvida? A gente responde</h2>
        <div className="space-y-3">
          {[
            {
              q: "Já compro com outro fornecedor, preciso trocar tudo?",
              a: "Não precisa. Você continua comprando de quem já compra — a parceria é só mais uma opção com desconto pra vocês, sem exclusividade nem contrato.",
            },
            {
              q: "E se eu não tiver dinheiro pra comprar mais agora?",
              a: "Comece pelo comodato: a gente deixa produtos no terreiro sem custo nenhum na entrega. Você só paga o combinado depois de vender — não precisa investir nada do próprio bolso pra fazer parte.",
            },
            {
              q: "Tem taxa, mensalidade ou letra miúda?",
              a: "Não. É gratuito pra se cadastrar, não tem cobrança mensal, e você só compra quando quiser — o desconto do seu plano já vem aplicado, sem pegadinha.",
            },
            {
              q: "E se eu não conseguir manter o ritmo de pedidos?",
              a: "Sem problema — seu plano nunca é rebaixado automaticamente por ficar um tempo sem pedir. Ele só sobe quando você pede mais. No seu ritmo, sem pressão.",
            },
          ].map((item, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4">
              <p className="font-semibold text-foreground text-sm">{item.q}</p>
              <p className="text-sm text-muted-foreground mt-1">{item.a}</p>
            </div>
          ))}
        </div>
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
                  <h2 className="text-xl font-bold text-foreground">Comece a economizar no próximo pedido</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    2 minutos pra preencher, e seu terreiro já entra com 10% de desconto garantido
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
