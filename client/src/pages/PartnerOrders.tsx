import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-amber-900/40 text-amber-300 border-amber-700",
  confirmado: "bg-blue-900/40 text-blue-300 border-blue-700",
  entregue: "bg-green-900/40 text-green-400 border-green-700",
  cancelado: "bg-red-900/40 text-red-400 border-red-700",
};

export default function PartnerOrders() {
  const utils = trpc.useUtils();
  const ordersQuery = trpc.partnerOrders.list.useQuery();
  const orders = ordersQuery.data ?? [];

  const updateStatusMutation = trpc.partnerOrders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado!");
      utils.partnerOrders.list.invalidate();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-accent rounded-lg">
            <ClipboardList className="w-6 h-6 text-accent-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Pedidos dos Parceiros</h1>
        </div>
        <p className="text-muted-foreground">
          Pedidos feitos pelos terreiros na tela "Gerar Pedidos" — confirme, marque como entregue depois de comprar
          do fornecedor, ou cancele.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos</CardTitle>
          <CardDescription>Mais recentes primeiro</CardDescription>
        </CardHeader>
        <CardContent>
          {ordersQuery.isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum pedido de parceiro ainda</div>
          ) : (
            <>
            {/* Cards no celular */}
            <div className="md:hidden space-y-3">
              {orders.map((order: any) => (
                <div key={order.id} className="p-3 bg-background rounded-lg border border-border space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground text-sm">Pedido #{order.id}</p>
                      <p className="text-xs text-muted-foreground">{order.terreiroName ?? "Parceiro removido"}</p>
                    </div>
                    <Badge className={`shrink-0 text-[10px] ${STATUS_COLORS[order.status] ?? ""}`}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {order.items.map((item: any) => (
                      <p key={item.id}>
                        {item.quantity}x {item.name} — R$ {(item.totalPrice / 100).toFixed(2)}
                      </p>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <p className="text-sm font-bold text-accent">R$ {(order.subtotal / 100).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Select
                    value={order.status}
                    onValueChange={(status) => updateStatusMutation.mutate({ id: order.id, status: status as any })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Tabela no computador */}
            <div className="overflow-x-auto hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order: any) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">#{order.id}</TableCell>
                    <TableCell className="text-muted-foreground">{order.terreiroName ?? "Parceiro removido"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-xs">
                      {order.items.map((item: any) => `${item.quantity}x ${item.name}`).join(", ")}
                    </TableCell>
                    <TableCell className="font-semibold text-accent">R$ {(order.subtotal / 100).toFixed(2)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={order.status}
                        onValueChange={(status) => updateStatusMutation.mutate({ id: order.id, status: status as any })}
                      >
                        <SelectTrigger className="w-36 ml-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
