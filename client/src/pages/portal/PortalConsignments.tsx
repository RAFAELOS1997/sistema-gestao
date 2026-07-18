import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

// Visão do terreiro: itens que a Toca da Pantera deixou com ele (comodato).
// Somente leitura — o acerto (vendido/devolvido) é feito pela loja.
export default function PortalConsignments() {
  const [showSettled, setShowSettled] = useState(false);
  const consignmentsQuery = trpc.portal.consignments.list.useQuery({ includeSettled: showSettled });
  const consignments = consignmentsQuery.data ?? [];

  const totalPending = consignments.reduce(
    (sum, c) => sum + (c.quantity - c.quantitySold - c.quantityReturned),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Itens em Comodato</h1>
          <p className="text-muted-foreground text-sm">
            Itens que a Toca da Pantera deixou com o seu terreiro — pagos só se vendidos, devolvidos se não.
            {totalPending > 0 && <span> {totalPending} item(ns) pendente(s) de acerto.</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowSettled((v) => !v)}>
          {showSettled ? "Só pendentes" : "Ver histórico"}
        </Button>
      </div>

      {consignmentsQuery.isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : consignments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {showSettled ? "Nenhum comodato registrado ainda." : "Nenhum item pendente no momento."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Deixado em</TableHead>
                <TableHead>Deixados</TableHead>
                <TableHead>Vendidos</TableHead>
                <TableHead>Devolvidos</TableHead>
                <TableHead>Pendentes</TableHead>
                <TableHead>Preço combinado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consignments.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {c.productName}
                    {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(c.leftAt).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>{c.quantity}</TableCell>
                  <TableCell className="text-green-400">{c.quantitySold}</TableCell>
                  <TableCell className="text-muted-foreground">{c.quantityReturned}</TableCell>
                  <TableCell className="font-semibold text-accent">
                    {c.quantity - c.quantitySold - c.quantityReturned}
                  </TableCell>
                  <TableCell>R$ {(c.unitPrice / 100).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
