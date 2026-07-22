import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Power, Medal, Eye, Link2, UserPlus, Check, X, Search, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const NO_TIER = "sem-plano";

const EMPTY_FORM = { name: "", username: "", password: "", contactName: "", phone: "", tierId: NO_TIER };

const EMPTY_PROSPECT_FORM = { terreiroName: "", contactName: "", phone: "", city: "Ribeirão Preto", instagram: "", address: "", notes: "" };

const SOURCE_LABEL: Record<string, string> = { site: "Site", prospeccao: "Prospecção" };

export default function Partners() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isProspectDialogOpen, setIsProspectDialogOpen] = useState(false);
  const [prospectForm, setProspectForm] = useState(EMPTY_PROSPECT_FORM);
  const [showAllApplications, setShowAllApplications] = useState(false);

  const utils = trpc.useUtils();
  const { data: terreiros = [], isLoading } = trpc.terreiros.list.useQuery({ includeInactive: true });
  const { data: tiers = [] } = trpc.partnerTiers.list.useQuery();
  const { data: openConsignments = [] } = trpc.terreiros.consignments.openCountByTerreiro.useQuery();
  const { data: pendingConsignmentRequests = [] } = trpc.terreiros.consignmentRequests.pendingCountByTerreiro.useQuery();
  const { data: spendingTotals = [] } = trpc.terreiros.spendingTotals.useQuery();
  const { data: applications = [] } = trpc.partnerApplications.list.useQuery();
  const pendingApplications = applications.filter((a: any) => a.status === "pendente");
  const visibleApplications = showAllApplications ? applications : pendingApplications;
  const applicationStatusMutation = trpc.partnerApplications.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Atualizado!");
      utils.partnerApplications.list.invalidate();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });
  const createProspectMutation = trpc.partnerApplications.createManual.useMutation({
    onSuccess: () => {
      toast.success("Lead adicionado à lista de prospecção!");
      setIsProspectDialogOpen(false);
      setProspectForm(EMPTY_PROSPECT_FORM);
      utils.partnerApplications.list.invalidate();
    },
    onError: (error) => toast.error(`Erro ao adicionar lead: ${error.message}`),
  });
  const deleteApplicationMutation = trpc.partnerApplications.delete.useMutation({
    onSuccess: () => {
      toast.success("Removido!");
      utils.partnerApplications.list.invalidate();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });
  const searchProspectsMutation = trpc.partnerApplications.searchProspects.useMutation({
    onSuccess: (result) => {
      if (result.added > 0) {
        toast.success(`Busca concluída: ${result.added} terreiro(s) novo(s) adicionado(s)!`);
      } else if (result.totalFound > 0) {
        toast.info(`Busca concluída: ${result.totalFound} encontrado(s), mas todos já estavam na lista.`);
      } else {
        toast.info("Busca concluída: nada novo encontrado no mapa dessa vez. Tente de novo mais tarde.");
      }
      utils.partnerApplications.list.invalidate();
    },
    onError: (error) => toast.error(`Erro na busca: ${error.message}`),
  });
  const tierName = (tierId: number | null) => tiers.find((t) => t.id === tierId)?.name ?? null;
  const openItemsOf = (terreiroId: number) =>
    Number(openConsignments.find((c) => c.terreiroId === terreiroId)?.openItems ?? 0);
  const pendingRequestsOf = (terreiroId: number) =>
    Number(pendingConsignmentRequests.find((c: any) => c.terreiroId === terreiroId)?.openRequests ?? 0);
  const spentBy = (terreiroId: number) =>
    Number(spendingTotals.find((s: any) => s.terreiroId === terreiroId)?.totalSpent ?? 0);

  const createMutation = trpc.terreiros.create.useMutation({
    onSuccess: () => {
      toast.success("Login do terreiro criado com sucesso!");
      handleCloseDialog();
      utils.terreiros.list.invalidate();
    },
    onError: (error) => toast.error(`Erro ao criar login: ${error.message}`),
  });

  const updateMutation = trpc.terreiros.update.useMutation({
    onSuccess: () => {
      toast.success("Login do terreiro atualizado!");
      handleCloseDialog();
      utils.terreiros.list.invalidate();
    },
    onError: (error) => toast.error(`Erro ao atualizar: ${error.message}`),
  });

  const setActiveMutation = trpc.terreiros.setActive.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado!");
      utils.terreiros.list.invalidate();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.username) {
      toast.error("Preencha nome do terreiro e usuário");
      return;
    }

    const tierId = formData.tierId === NO_TIER ? null : Number(formData.tierId);

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        name: formData.name,
        username: formData.username,
        contactName: formData.contactName || undefined,
        phone: formData.phone || undefined,
        tierId,
        ...(formData.password ? { password: formData.password } : {}),
      });
    } else {
      if (!formData.password || formData.password.length < 6) {
        toast.error("Senha deve ter ao menos 6 caracteres");
        return;
      }
      createMutation.mutate({
        name: formData.name,
        username: formData.username,
        password: formData.password,
        contactName: formData.contactName || undefined,
        phone: formData.phone || undefined,
        tierId,
      });
    }
  };

  const handleEdit = (terreiro: any) => {
    setEditingId(terreiro.id);
    setFormData({
      name: terreiro.name || "",
      username: terreiro.username || "",
      password: "",
      contactName: terreiro.contactName || "",
      phone: terreiro.phone || "",
      tierId: terreiro.tierId ? String(terreiro.tierId) : NO_TIER,
    });
    setIsDialogOpen(true);
  };

  const handleToggleActive = (terreiro: any) => {
    const activating = !terreiro.isActive;
    if (!confirm(`${activating ? "Ativar" : "Desativar"} o acesso de "${terreiro.name}" ao portal?`)) return;
    setActiveMutation.mutate({ id: terreiro.id, isActive: activating });
  };

  // "Aprovar" já marca a solicitação/lead como aprovado E abre o cadastro de
  // terreiro pré-preenchido — fecha o ciclo prospecção → parceiro num clique.
  const handleApproveApplication = (app: any) => {
    applicationStatusMutation.mutate({ id: app.id, status: "aprovado" });
    setEditingId(null);
    setFormData({
      name: app.terreiroName || "",
      username: "",
      password: "",
      contactName: app.contactName || "",
      phone: app.phone || "",
      tierId: NO_TIER,
    });
    setIsDialogOpen(true);
  };

  const handleSubmitProspect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prospectForm.terreiroName) {
      toast.error("Preencha ao menos o nome do terreiro");
      return;
    }
    createProspectMutation.mutate({
      terreiroName: prospectForm.terreiroName,
      contactName: prospectForm.contactName || undefined,
      phone: prospectForm.phone || undefined,
      city: prospectForm.city || undefined,
      instagram: prospectForm.instagram || undefined,
      address: prospectForm.address || undefined,
      notes: prospectForm.notes || undefined,
    });
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Terreiros Parceiros</h1>
          <p className="text-muted-foreground">Cadastre o login e o plano de cada terreiro parceiro</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={async () => {
              const url = `${window.location.origin}/parceiros/login`;
              try {
                await navigator.clipboard.writeText(url);
                toast.success("Link do portal copiado! Manda pro terreiro no WhatsApp.");
              } catch {
                toast.info(url);
              }
            }}
          >
            <Link2 className="w-4 h-4 mr-2" />
            Copiar link do portal
          </Button>
          <Link href="/planos-parceria">
            <Button variant="outline">
              <Medal className="w-4 h-4 mr-2" />
              Planos e Preços
            </Button>
          </Link>
          <Button
            variant="outline"
            disabled={searchProspectsMutation.isPending}
            onClick={() => searchProspectsMutation.mutate({ city: "Ribeirão Preto" })}
            title="Busca no OpenStreetMap (mapa aberto e gratuito) por terreiros/centros ainda não cadastrados"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {searchProspectsMutation.isPending ? "Buscando..." : "Buscar Automaticamente"}
          </Button>
          <Dialog open={isProspectDialogOpen} onOpenChange={setIsProspectDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Search className="w-4 h-4 mr-2" />
                Prospectar Terreiro
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Lead de Prospecção</DialogTitle>
                <DialogDescription>
                  Terreiro que você achou (Google, Instagram, indicação) pra entrar em contato depois. Cai na
                  mesma lista de "Solicitações de Parceria" — quando aprovar, já abre o cadastro de login.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmitProspect} className="space-y-4">
                <div>
                  <Label htmlFor="prospectName">Nome do terreiro</Label>
                  <Input
                    id="prospectName"
                    value={prospectForm.terreiroName}
                    onChange={(e) => setProspectForm({ ...prospectForm, terreiroName: e.target.value })}
                    placeholder="Ex: Terreiro Tia Maria e Cabocla Jupira"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="prospectContact">Pessoa de contato (opcional)</Label>
                    <Input
                      id="prospectContact"
                      value={prospectForm.contactName}
                      onChange={(e) => setProspectForm({ ...prospectForm, contactName: e.target.value })}
                      placeholder="Ex: Mãe/Pai de santo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="prospectPhone">Telefone / WhatsApp (opcional)</Label>
                    <Input
                      id="prospectPhone"
                      value={prospectForm.phone}
                      onChange={(e) => setProspectForm({ ...prospectForm, phone: e.target.value })}
                      placeholder="(16) 99999-9999"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="prospectCity">Cidade</Label>
                    <Input
                      id="prospectCity"
                      value={prospectForm.city}
                      onChange={(e) => setProspectForm({ ...prospectForm, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="prospectInstagram">Instagram (opcional)</Label>
                    <Input
                      id="prospectInstagram"
                      value={prospectForm.instagram}
                      onChange={(e) => setProspectForm({ ...prospectForm, instagram: e.target.value })}
                      placeholder="@perfil"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="prospectAddress">Endereço (opcional)</Label>
                  <Input
                    id="prospectAddress"
                    value={prospectForm.address}
                    onChange={(e) => setProspectForm({ ...prospectForm, address: e.target.value })}
                    placeholder="Rua, número, bairro"
                  />
                </div>
                <div>
                  <Label htmlFor="prospectNotes">Observações (opcional)</Label>
                  <Input
                    id="prospectNotes"
                    value={prospectForm.notes}
                    onChange={(e) => setProspectForm({ ...prospectForm, notes: e.target.value })}
                    placeholder="Ex: gira toda sexta, achado no Google Maps"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={createProspectMutation.isPending}
                >
                  {createProspectMutation.isPending ? "Adicionando..." : "Adicionar à Lista"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={isDialogOpen} onOpenChange={(open) => (open ? setIsDialogOpen(true) : handleCloseDialog())}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="w-4 h-4 mr-2" />
                Novo Terreiro
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Terreiro" : "Cadastrar Terreiro Parceiro"}</DialogTitle>
                <DialogDescription>
                  {editingId ? "Atualize os dados de acesso do terreiro" : "Crie o login que o terreiro usará no Portal do Parceiro"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome do terreiro</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Terreiro Ilê Axé..."
                  />
                </div>
                <div>
                  <Label htmlFor="username">Usuário de acesso</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="ex: terreiro-oxala"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label htmlFor="password">{editingId ? "Nova senha (opcional)" : "Senha"}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingId ? "Deixe em branco para manter" : "Mínimo 6 caracteres"}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <Label htmlFor="tierId">Plano</Label>
                  <Select value={formData.tierId} onValueChange={(v) => v && setFormData({ ...formData, tierId: v })}>
                    <SelectTrigger id="tierId">
                      <SelectValue>
                        {formData.tierId === NO_TIER ? "Sem plano" : tiers.find((t) => String(t.id) === formData.tierId)?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_TIER}>Sem plano (não vê produtos ainda)</SelectItem>
                      {tiers.map((tier) => (
                        <SelectItem key={tier.id} value={String(tier.id)}>{tier.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Defina os preços de cada plano em "Planos e Preços"
                  </p>
                </div>
                <div>
                  <Label htmlFor="contactName">Pessoa de contato (opcional)</Label>
                  <Input
                    id="contactName"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    placeholder="Nome de quem cuida do pedido"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone (opcional)</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? "Processando..." : editingId ? "Atualizar" : "Criar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {applications.length > 0 && (
        <Card className="border-accent/40">
          <CardHeader className="flex flex-row items-start justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-accent" />
                Solicitações e Prospecção ({visibleApplications.length})
              </CardTitle>
              <CardDescription>
                Terreiros que se cadastraram na página "Parceria com a Toca", que você achou e adicionou em
                "Prospectar Terreiro", ou que "Buscar Automaticamente" encontrou sozinho no mapa — aprovar já abre
                o cadastro de login pré-preenchido
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowAllApplications((v) => !v)}>
              {showAllApplications ? "Só pendentes" : "Ver todas"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleApplications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma solicitação pendente</p>
            ) : (
              visibleApplications.map((app: any) => (
                <div key={app.id} className="p-3 bg-background rounded-lg border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground text-sm">{app.terreiroName}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {SOURCE_LABEL[app.source] ?? app.source}
                      </Badge>
                      {app.status !== "pendente" && (
                        <Badge
                          className={`text-[10px] px-1.5 py-0 ${app.status === "aprovado" ? "bg-green-900/30 text-green-200" : "bg-red-900/30 text-red-200"}`}
                        >
                          {app.status === "aprovado" ? "Aprovado" : "Recusado"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {app.contactName} · {app.phone}{app.city ? ` · ${app.city}` : ""}
                      {app.instagram ? ` · ${app.instagram}` : ""}
                    </p>
                    {app.address && <p className="text-xs text-muted-foreground">{app.address}</p>}
                    {app.notes && <p className="text-xs text-muted-foreground mt-1">"{app.notes}"</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {app.status === "pendente" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => handleApproveApplication(app)}
                          disabled={applicationStatusMutation.isPending}
                        >
                          <Check className="w-3.5 h-3.5 mr-1 text-green-500" />
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => applicationStatusMutation.mutate({ id: app.id, status: "recusado" })}
                          disabled={applicationStatusMutation.isPending}
                        >
                          <X className="w-3.5 h-3.5 mr-1 text-destructive" />
                          Recusar
                        </Button>
                      </>
                    )}
                    {app.status !== "pendente" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => {
                          if (confirm(`Remover "${app.terreiroName}" da lista?`)) deleteApplicationMutation.mutate({ id: app.id });
                        }}
                        disabled={deleteApplicationMutation.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Terreiros Cadastrados</CardTitle>
          <CardDescription>Login, plano e status de acesso ao Portal do Parceiro</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : terreiros.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum terreiro cadastrado ainda</div>
          ) : (
            <>
            {/* Lista em cards no celular */}
            <div className="md:hidden space-y-2 sm:space-y-3">
              {terreiros.map((t: any) => (
                <div key={t.id} className="p-3 bg-background rounded-lg border border-border space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-foreground text-sm leading-snug">{t.name}</p>
                    <Badge
                      className={`shrink-0 text-[10px] ${t.isActive ? "bg-green-900/40 text-green-400 border-green-700" : "bg-red-900/40 text-red-400 border-red-700"}`}
                    >
                      {t.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.username}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {tierName(t.tierId) ? (
                      <span className="px-2 py-1 rounded text-xs bg-accent/20 text-accent">{tierName(t.tierId)}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sem plano</span>
                    )}
                    {openItemsOf(t.id) > 0 && (
                      <span className="px-2 py-1 rounded text-xs bg-amber-900/30 text-amber-200">
                        {openItemsOf(t.id)} item(ns) em comodato
                      </span>
                    )}
                    {pendingRequestsOf(t.id) > 0 && (
                      <span className="px-2 py-1 rounded text-xs bg-accent/20 text-accent border border-accent/30">
                        {pendingRequestsOf(t.id)} solicitação(ões) de comodato
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground">
                    Total gasto: <span className="font-semibold text-accent">R$ {(spentBy(t.id) / 100).toFixed(2)}</span>
                  </p>
                  <div className="text-xs text-muted-foreground">
                    {(t.contactName || t.phone) && (
                      <p>
                        {t.contactName || "-"}
                        {t.phone ? ` · ${t.phone}` : ""}
                      </p>
                    )}
                    <p>
                      Último acesso:{" "}
                      {t.lastSignedIn
                        ? new Date(t.lastSignedIn).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                        : "Nunca entrou"}
                    </p>
                  </div>
                  <div className="flex gap-2 pt-1 border-t border-border">
                    <Link href={`/parceiros-terreiros/${t.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full h-9">
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Ver
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(t)} className="h-9 w-9 p-0">
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(t)}
                      disabled={setActiveMutation.isPending}
                      className="h-9 w-9 p-0"
                    >
                      <Power className={`w-3.5 h-3.5 ${t.isActive ? "text-red-500" : "text-green-500"}`} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Tabela no computador */}
            <div className="overflow-x-auto hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Terreiro</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Total gasto</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Em comodato</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {terreiros.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">{t.username}</TableCell>
                    <TableCell>
                      {tierName(t.tierId) ? (
                        <span className="px-2 py-1 rounded text-sm bg-accent/20 text-accent">{tierName(t.tierId)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem plano</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-accent">
                      R$ {(spentBy(t.id) / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.contactName || "-"}
                      {t.phone ? ` · ${t.phone}` : ""}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        {openItemsOf(t.id) > 0 && (
                          <span className="px-2 py-1 rounded text-sm bg-amber-900/30 text-amber-200">
                            {openItemsOf(t.id)} item(ns)
                          </span>
                        )}
                        {pendingRequestsOf(t.id) > 0 && (
                          <span className="px-2 py-1 rounded text-xs bg-accent/20 text-accent border border-accent/30">
                            {pendingRequestsOf(t.id)} pedido(s) pendente(s)
                          </span>
                        )}
                        {openItemsOf(t.id) === 0 && pendingRequestsOf(t.id) === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {t.lastSignedIn
                        ? new Date(t.lastSignedIn).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                        : "Nunca entrou"}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-sm ${t.isActive ? "bg-green-900/30 text-green-200" : "bg-red-900/30 text-red-200"}`}>
                        {t.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Link href={`/parceiros-terreiros/${t.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(t)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(t)}
                        disabled={setActiveMutation.isPending}
                      >
                        <Power className={`w-4 h-4 ${t.isActive ? "text-red-500" : "text-green-500"}`} />
                      </Button>
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
    </div>
  );
}
