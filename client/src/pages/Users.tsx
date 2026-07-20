import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export function Users() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", role: "user" as const });

  const utils = trpc.useUtils();
  const { data: users = [], isLoading } = trpc.users.list.useQuery();
  
  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      setFormData({ name: "", email: "", password: "", role: "user" });
      setIsDialogOpen(false);
      utils.users.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao criar usuário: ${error.message}`);
    },
  });

  const updateMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("Usuário atualizado com sucesso!");
      setFormData({ name: "", email: "", password: "", role: "user" });
      setEditingId(null);
      setIsDialogOpen(false);
      utils.users.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar usuário: ${error.message}`);
    },
  });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("Usuário deletado com sucesso!");
      utils.users.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao deletar usuário: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email) {
      toast.error("Preencha todos os campos");
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, name: formData.name, email: formData.email, role: formData.role });
    } else {
      if (!formData.password || formData.password.length < 6) {
        toast.error("Senha deve ter ao menos 6 caracteres");
        return;
      }
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (user: any) => {
    setEditingId(user.id);
    setFormData({ name: user.name || "", email: user.email || "", password: "", role: user.role });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja deletar este usuário?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData({ name: "", email: "", password: "", role: "user" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground">Crie e gerencie usuários do sistema</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="w-4 h-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Usuário" : "Criar Novo Usuário"}</DialogTitle>
              <DialogDescription>
                {editingId ? "Atualize os dados do usuário" : "Preencha os dados para criar um novo usuário"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do usuário"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              {!editingId && (
                <div>
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="role">Função</Label>
                <Select value={formData.role} onValueChange={(value: any) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "Processando..." : editingId ? "Atualizar" : "Criar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários do Sistema</CardTitle>
          <CardDescription>Lista de todos os usuários cadastrados</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Carregando usuários...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum usuário cadastrado</div>
          ) : (
            <>
            {/* Lista em cards no celular */}
            <div className="md:hidden space-y-2 sm:space-y-3">
              {users.map((user: any) => (
                <div key={user.id} className="p-3 bg-background rounded-lg border border-border space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-foreground text-sm leading-snug">{user.name || "N/A"}</p>
                    <Badge className={`shrink-0 text-[10px] ${user.role === "admin" ? "bg-red-900/40 text-red-400 border-red-700" : "bg-blue-900/40 text-blue-400 border-blue-700"}`}>
                      {user.role === "admin" ? "Administrador" : "Usuário"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{user.email || "N/A"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Criado em {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                  <div className="flex gap-2 pt-1 border-t border-border">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(user)}
                      className="flex-1 h-9"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(user.id)}
                      disabled={deleteMutation.isPending}
                      className="h-9 w-9 p-0"
                      title="Excluir usuário"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
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
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Data de Criação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name || "N/A"}</TableCell>
                      <TableCell>{user.email || "N/A"}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-sm ${user.role === "admin" ? "bg-red-900/30 text-red-200" : "bg-blue-900/30 text-blue-200"}`}>
                          {user.role === "admin" ? "Administrador" : "Usuário"}
                        </span>
                      </TableCell>
                      <TableCell>{new Date(user.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(user)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(user.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
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
