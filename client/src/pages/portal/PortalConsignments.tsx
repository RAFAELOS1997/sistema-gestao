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
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-foreground">Itens em Comodato</h1>
          <p className="text-muted-foreground text-sm">
            Itens que a Toca da Pantera deixou com o seu terreiro — pagos só se vendidos, devolvidos se não.
            {totalPending > 0 && <span> {totalPending} item(ns) pendente(s) de acerto.</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-9" onClick={() => setShowSettled((v) => !v)}>
          {showSettled ? "Só pendentes" : "Ver histórico"}
        </Button>
      </div>

      {consignmentsQuery.isLoading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Carregando...</div>
      ) : consignments.length === 0 ? (
        <div className="text-center py-12 px-4 text-muted-foreground text-sm">
          {showSettled ? "Nenhum comodato registrado ainda." : "Nenhum item pendente no momento."}
        </div>
      ) : (
        <>
          {/* Celular: cards empilhados, sem tabela pra não estourar a largura da tela */}
          <div className="grid gap-3 sm:hidden">
            {consignments.map((c) => {
              const pending = c.quantity - c.quantitySold - c.quantityReturned;
              return (
                <div key={c.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
                  <div>
                    <p className="font-medium text-sm text-foreground break-words">{c.productName}</p>
                    {c.notes && <p className="text-xs text-muted-foreground mt-0.5 break-words">{c.notes}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Deixado em {new Date(c.leftAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center border-t border-border pt-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Deixados</p>
                      <p className="text-sm font-medium text-foreground">{c.quantity}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Vendidos</p>
                      <p className="text-sm font-medium text-green-400">{c.quantitySold}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Devolvidos</p>
                      <p className="text-sm font-medium text-muted-foreground">{c.quantityReturned}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Pendentes</p>
                      <p className="text-sm font-semibold text-accent">{pending}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground border-t border-border pt-2">
                    Preço combinado: <span className="text-foreground font-medium">R$ {(c.unitPrice / 100).toFixed(2)}</span>
                  </p>
                </div>
              );
            })}
          </div>

          {/* Telas maiores: tabela completa */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border border-border">
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
        </>
      )}
    </div>
  );
}
