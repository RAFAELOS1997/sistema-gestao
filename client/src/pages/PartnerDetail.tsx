import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Power } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import ConsignmentManager from "@/components/ConsignmentManager";

const NO_TIER = "sem-plano";

// Referências estáveis: um array/objeto literal como valor padrão de
// destructuring é recriado a cada render — um efeito que dependa dele
// dispararia infinitamente (setState -> nova referência -> setState...).
const EMPTY_PRICE_ROWS: {
  productId: number;
  name: string;
  category: string;
  currentStock: number;
  tierPrice: number | null;
  overridePrice: number | null;
}[] = [];

export default function PartnerDetail() {
  const { id } = useParams<{ id: string }>();
  const terreiroId = Number(id);

  const [form, setForm] = useState({ name: "", username: "", password: "", contactName: "", phone: "", tierId: NO_TIER });
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});

  const utils = trpc.useUtils();
  const { data: terreiro, isLoading } = trpc.terreiros.getById.useQuery({ id: terreiroId }, { enabled: !!terreiroId });
  const { data: tiers = [] } = trpc.partnerTiers.list.useQuery();
  const { data: spendingTotals = [] } = trpc.terreiros.spendingTotals.useQuery();
  const spending = spendingTotals.find((s: any) => s.terreiroId === terreiroId);
  const { data: priceRows = EMPTY_PRICE_ROWS, isLoading: loadingPrices } = trpc.terreiros.prices.list.useQuery(
    { terreiroId },
    { enabled: !!terreiroId }
  );

  useEffect(() => {
    if (!terreiro) return;
    setForm({
      name: terreiro.name || "",
      username: terreiro.username || "",
      password: "",
      contactName: terreiro.contactName || "",
      phone: terreiro.phone || "",
      tierId: terreiro.tierId ? String(terreiro.tierId) : NO_TIER,
    });
  }, [terreiro]);

  useEffect(() => {
    const drafts: Record<number, string> = {};
    for (const row of priceRows) {
      drafts[row.productId] = row.overridePrice != null ? (row.overridePrice / 100).toFixed(2) : "";
    }
    setPriceDrafts(drafts);
  }, [priceRows]);

  const updateMutation = trpc.terreiros.update.useMutation({
    onSuccess: () => {
      toast.success("Dados atualizados!");
      utils.terreiros.getById.invalidate({ id: terreiroId });
      utils.terreiros.list.invalidate();
    },
    onError: (error) => toast.error(`Erro ao atualizar: ${error.message}`),
  });

  const setActiveMutation = trpc.terreiros.setActive.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado!");
      utils.terreiros.getById.invalidate({ id: terreiroId });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const setPriceMutation = trpc.terreiros.prices.setPrice.useMutation({
    onSuccess: () => {
      toast.success("Preço específico salvo!");
      utils.terreiros.prices.list.invalidate({ terreiroId });
    },
    onError: (error) => toast.error(`Erro ao salvar preço: ${error.message}`),
  });

  const removePriceMutation = trpc.terreiros.prices.removePrice.useMutation({
    onSuccess: () => {
      toast.success("Voltou a usar o preço do plano");
      utils.terreiros.prices.list.invalidate({ terreiroId });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.username) {
      toast.error("Preencha nome e usuário");
      return;
    }
    updateMutation.mutate({
      id: terreiroId,
      name: form.name,
      username: form.username,
      contactName: form.contactName || undefined,
      phone: form.phone || undefined,
      tierId: form.tierId === NO_TIER ? null : Number(form.tierId),
      ...(form.password ? { password: form.password } : {}),
    });
  };

  const handleSavePrice = (productId: number) => {
    const raw = priceDrafts[productId];
    const value = Number(raw?.replace(",", "."));
    if (!raw || isNaN(value) || value <= 0) {
      toast.error("Informe um preço válido");
      return;
    }
    setPriceMutation.mutate({ terreiroId, productId, price: Math.round(value * 100) });
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  if (!terreiro) return <div className="text-center py-8 text-muted-foreground">Terreiro não encontrado</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/parceiros-terreiros">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{terreiro.name}</h1>
          <p className="text-muted-foreground text-sm">Gestão individual do terreiro parceiro</p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 pt-6">
          <div>
            <p className="text-xs text-muted-foreground">Total gasto na loja</p>
            <p className="text-2xl font-bold text-accent">
              R$ {((spending?.totalSpent ?? 0) / 100).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pedidos</p>
            <p className="text-2xl font-bold text-foreground">{spending?.ordersCount ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Última compra</p>
            <p className="text-sm text-foreground pt-1.5">
              {spending?.lastPurchaseAt
                ? new Date(spending.lastPurchaseAt).toLocaleDateString("pt-BR")
                : "Nenhuma ainda"}
            </p>
          </div>
          <p className="text-xs text-muted-foreground w-full">
            Usado como base pra decidir se esse parceiro merece subir de plano
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle>Dados de acesso</CardTitle>
            <CardDescription>Login, plano e contato desse terreiro</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveMutation.mutate({ id: terreiroId, isActive: !terreiro.isActive })}
            disabled={setActiveMutation.isPending}
            className="w-full sm:w-auto h-9"
          >
            <Power className={`w-4 h-4 mr-2 ${terreiro.isActive ? "text-red-500" : "text-green-500"}`} />
            {terreiro.isActive ? "Desativar acesso" : "Ativar acesso"}
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveInfo} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nome do terreiro</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="username">Usuário de acesso</Label>
              <Input id="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="password">Nova senha (opcional)</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Deixe em branco pra manter"
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label htmlFor="tierId">Plano</Label>
              <Select value={form.tierId} onValueChange={(v) => v && setForm({ ...form, tierId: v })}>
                <SelectTrigger id="tierId">
                  <SelectValue>
                    {form.tierId === NO_TIER ? "Sem plano" : tiers.find((t) => String(t.id) === form.tierId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TIER}>Sem plano</SelectItem>
                  {tiers.map((tier) => (
                    <SelectItem key={tier.id} value={String(tier.id)}>{tier.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="contactName">Pessoa de contato</Label>
              <Input id="contactName" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar dados"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preços específicos desse terreiro</CardTitle>
          <CardDescription>
            Por padrão ele vê o preço do plano. Defina um preço aqui só pra sobrescrever nesse terreiro específico
            (ex: uma negociação pontual) — o resto do plano continua igual pros outros parceiros.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPrices ? (
            <div className="text-center py-8 text-muted-foreground">Carregando produtos...</div>
          ) : priceRows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum produto ativo cadastrado</div>
          ) : (
            <>
            {/* Lista em cards no celular */}
            <div className="md:hidden space-y-2 sm:space-y-3">
              {priceRows.map((row) => (
                <div key={row.productId} className="p-3 bg-background rounded-lg border border-border space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-foreground text-sm leading-snug">{row.name}</p>
                    <Badge variant="outline" className="shrink-0 text-[10px] border-border text-muted-foreground">
                      Estoque: {row.currentStock}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Preço do plano:{" "}
                    {row.tierPrice != null ? `R$ ${(row.tierPrice / 100).toFixed(2)}` : "Sem preço no plano"}
                  </p>
                  <div>
                    <Label htmlFor={`price-${row.productId}`} className="text-xs">Preço específico (R$)</Label>
                    <Input
                      id={`price-${row.productId}`}
                      type="number"
                      step="0.01"
                      min="0"
                      className="mt-1 h-9"
                      placeholder="Usa o do plano"
                      value={priceDrafts[row.productId] ?? ""}
                      onChange={(e) => setPriceDrafts({ ...priceDrafts, [row.productId]: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2 pt-1 border-t border-border">
                    <Button
                      size="sm"
                      onClick={() => handleSavePrice(row.productId)}
                      disabled={setPriceMutation.isPending}
                      className="flex-1 h-9"
                    >
                      Salvar
                    </Button>
                    {row.overridePrice != null && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removePriceMutation.mutate({ terreiroId, productId: row.productId })}
                        disabled={removePriceMutation.isPending}
                        className="flex-1 h-9"
                      >
                        Usar do plano
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Tabela no computador */}
            <div className="overflow-x-auto hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Preço do plano</TableHead>
                  <TableHead>Preço específico (R$)</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priceRows.map((row) => (
                  <TableRow key={row.productId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">{row.currentStock}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.tierPrice != null ? `R$ ${(row.tierPrice / 100).toFixed(2)}` : "Sem preço no plano"}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-28"
                        placeholder="Usa o do plano"
                        value={priceDrafts[row.productId] ?? ""}
                        onChange={(e) => setPriceDrafts({ ...priceDrafts, [row.productId]: e.target.value })}
                      />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" onClick={() => handleSavePrice(row.productId)} disabled={setPriceMutation.isPending}>
                        Salvar
                      </Button>
                      {row.overridePrice != null && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removePriceMutation.mutate({ terreiroId, productId: row.productId })}
                          disabled={removePriceMutation.isPending}
                        >
                          Usar preço do plano
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <ConsignmentManager terreiroId={terreiroId} />
    </div>
  );
}
