import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit2, Power, Medal } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const NO_TIER = "sem-plano";

const EMPTY_FORM = { name: "", username: "", password: "", contactName: "", phone: "", tierId: NO_TIER };

export default function Partners() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const utils = trpc.useUtils();
  const { data: terreiros = [], isLoading } = trpc.terreiros.list.useQuery({ includeInactive: true });
  const { data: tiers = [] } = trpc.partnerTiers.list.useQuery();
  const tierName = (tierId: number | null) => tiers.find((t) => t.id === tierId)?.name ?? null;

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
        <div className="flex items-center gap-2">
          <Link href="/planos-parceria">
            <Button variant="outline">
              <Medal className="w-4 h-4 mr-2" />
              Planos e Preços
            </Button>
          </Link>
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
                  <Select value={formData.tierId} onValueChange={(v) => setFormData({ ...formData, tierId: v })}>
                    <SelectTrigger id="tierId">
                      <SelectValue />
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Terreiro</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Contato</TableHead>
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
                    <TableCell className="text-muted-foreground">
                      {t.contactName || "-"}
                      {t.phone ? ` · ${t.phone}` : ""}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-sm ${t.isActive ? "bg-green-900/30 text-green-200" : "bg-red-900/30 text-red-200"}`}>
                        {t.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
