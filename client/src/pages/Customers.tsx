import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Users2, Mail, Phone, MapPin } from "lucide-react";

export default function Customers() {
  const [search, setSearch] = useState("");
  const customersQuery = trpc.customers.list.useQuery();
  const all = customersQuery.data ?? [];

  const filtered = all.filter((c: any) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.phone ?? "").includes(q);
  });

  const totalOrders = all.reduce((sum: number, c: any) => sum + c.orderCount, 0);
  const totalSpent = all.reduce((sum: number, c: any) => sum + c.totalSpent, 0);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-accent rounded-lg">
            <Users2 className="w-6 h-6 text-accent-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
        </div>
        <p className="text-muted-foreground">
          Quem criou conta na loja pública (Pronta Entrega / Fazer Pedidos) — só consulta, o cliente edita os próprios dados em "Minha Conta".
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-foreground">{all.length}</p>
            <p className="text-xs text-muted-foreground">Clientes cadastrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-foreground">{totalOrders}</p>
            <p className="text-xs text-muted-foreground">Pedidos feitos logado</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-accent">R$ {(totalSpent / 100).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Total gasto (logados)</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de clientes</CardTitle>
          <CardDescription>Busque por nome, e-mail ou telefone</CardDescription>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="mt-2 max-w-sm" />
        </CardHeader>
        <CardContent>
          {customersQuery.isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</div>
          ) : (
            <>
              {/* Cards no celular */}
              <div className="md:hidden space-y-3">
                {filtered.map((c: any) => (
                  <div key={c.id} className="p-3 bg-background rounded-lg border border-border space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground text-sm">{c.name}</p>
                      <Badge className="text-[10px] bg-accent/15 text-accent border-accent/30 shrink-0">{c.orderCount} pedido(s)</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</p>
                    {c.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</p>}
                    {c.shippingCity && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> {c.shippingCity}/{c.shippingState}</p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {c.hasGoogle && <Badge className="text-[9px] bg-blue-900/40 text-blue-300 border-blue-700">Google</Badge>}
                      {c.hasPassword && <Badge className="text-[9px] bg-background text-muted-foreground border-border">Senha</Badge>}
                      <span className="text-xs text-muted-foreground ml-auto">R$ {(c.totalSpent / 100).toFixed(2)}</span>
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
                      <TableHead>Contato</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Login</TableHead>
                      <TableHead className="text-right">Pedidos</TableHead>
                      <TableHead className="text-right">Total gasto</TableHead>
                      <TableHead>Cadastrado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          <div>{c.email}</div>
                          {c.phone && <div className="text-xs">{c.phone}</div>}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {c.shippingCity ? `${c.shippingCity}/${c.shippingState}` : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {c.hasGoogle && <Badge className="text-[9px] bg-blue-900/40 text-blue-300 border-blue-700">Google</Badge>}
                            {c.hasPassword && <Badge className="text-[9px] bg-background text-muted-foreground border-border">Senha</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{c.orderCount}</TableCell>
                        <TableCell className="text-right font-semibold text-accent">R$ {(c.totalSpent / 100).toFixed(2)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(c.createdAt).toLocaleDateString("pt-BR")}
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
