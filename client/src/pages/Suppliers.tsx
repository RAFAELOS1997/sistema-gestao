import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Truck, Plus, Edit2, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface FormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  cnpj: string;
  paymentTerms: string;
}

const emptyForm: FormData = {
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  cnpj: "",
  paymentTerms: "",
};

export default function Suppliers() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: suppliers = [], isLoading } = trpc.suppliers.list.useQuery();
  const createMutation = trpc.suppliers.create.useMutation({
    onSuccess: () => { utils.suppliers.list.invalidate(); },
  });
  const updateMutation = trpc.suppliers.update.useMutation({
    onSuccess: () => { utils.suppliers.list.invalidate(); },
  });
  const deleteMutation = trpc.suppliers.delete.useMutation({
    onSuccess: () => { utils.suppliers.list.invalidate(); },
  });

  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setOpen(true);
  };

  const openEdit = (supplier: (typeof suppliers)[number]) => {
    setEditingId(supplier.id);
    setFormData({
      name: supplier.name,
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      address: supplier.address ?? "",
      city: supplier.city ?? "",
      state: supplier.state ?? "",
      zipCode: supplier.zipCode ?? "",
      cnpj: supplier.cnpj ?? "",
      paymentTerms: supplier.paymentTerms ?? "",
    });
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Fornecedor deletado com sucesso!");
      setDeleteDialogOpen(false);
      setDeleteId(null);
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao deletar fornecedor");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...formData });
        toast.success("Fornecedor atualizado com sucesso!");
      } else {
        await createMutation.mutateAsync(formData);
        toast.success("Fornecedor criado com sucesso!");
      }
      setOpen(false);
      setFormData(emptyForm);
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao salvar fornecedor");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-accent rounded-lg">
            <Truck className="w-6 h-6 text-accent-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Fornecedores</h1>
        </div>
        <p className="text-muted-foreground">Gerencie seus fornecedores e condições de compra</p>
      </div>

      {/* Search and Create */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar fornecedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background border-border text-foreground"
          />
        </div>
        <Button onClick={openCreate} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-2" />
          Novo Fornecedor
        </Button>
      </div>

      {/* Table */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Lista de Fornecedores</CardTitle>
          <CardDescription className="text-muted-foreground">{filteredSuppliers.length} fornecedor(es)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando fornecedores...</div>
          ) : filteredSuppliers.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-accent font-bold">Nome</TableHead>
                    <TableHead className="text-accent font-bold">Email</TableHead>
                    <TableHead className="text-accent font-bold">Telefone</TableHead>
                    <TableHead className="text-accent font-bold">Cidade</TableHead>
                    <TableHead className="text-accent font-bold">Condições de Pagamento</TableHead>
                    <TableHead className="text-accent font-bold text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="border-border hover:bg-background/50">
                      <TableCell className="font-medium text-foreground">{supplier.name}</TableCell>
                      <TableCell className="text-muted-foreground">{supplier.email || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{supplier.phone || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{supplier.city || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{supplier.paymentTerms || "-"}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(supplier)}
                          className="border-border text-accent hover:bg-background"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDeleteId(supplier.id);
                            setDeleteDialogOpen(true);
                          }}
                          className="border-border text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Nenhum fornecedor encontrado</div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingId ? "Editar Fornecedor" : "Novo Fornecedor"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editingId ? "Atualize os dados do fornecedor" : "Preencha os dados do novo fornecedor"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name" className="text-foreground">
                  Nome *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="mt-1 bg-background border-border text-foreground"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 bg-background border-border text-foreground"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-foreground">
                  Telefone
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 bg-background border-border text-foreground"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="address" className="text-foreground">
                  Endereço
                </Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="mt-1 bg-background border-border text-foreground"
                />
              </div>
              <div>
                <Label htmlFor="city" className="text-foreground">
                  Cidade
                </Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="mt-1 bg-background border-border text-foreground"
                />
              </div>
              <div>
                <Label htmlFor="state" className="text-foreground">
                  Estado
                </Label>
                <Input
                  id="state"
                  maxLength={2}
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                  className="mt-1 bg-background border-border text-foreground"
                />
              </div>
              <div>
                <Label htmlFor="zipCode" className="text-foreground">
                  CEP
                </Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  className="mt-1 bg-background border-border text-foreground"
                />
              </div>
              <div>
                <Label htmlFor="cnpj" className="text-foreground">
                  CNPJ
                </Label>
                <Input
                  id="cnpj"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  className="mt-1 bg-background border-border text-foreground"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="paymentTerms" className="text-foreground">
                  Condições de Pagamento
                </Label>
                <Input
                  id="paymentTerms"
                  value={formData.paymentTerms}
                  onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                  placeholder="Ex: 30 dias, À vista, Boleto"
                  className="mt-1 bg-background border-border text-foreground"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-border text-foreground">
                Cancelar
              </Button>
              <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90">
                {editingId ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Deletar Fornecedor</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja deletar este fornecedor? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel className="border-border text-foreground">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
