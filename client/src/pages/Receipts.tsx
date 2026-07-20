import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Receipt, Search, Printer, Download, RefreshCw, Eye } from "lucide-react";
import { toast } from "sonner";

export default function Receipts() {
  const [searchNumber, setSearchNumber] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);

  const { data: receipts, isLoading, refetch } = trpc.receipts.list.useQuery({ limit: 100 });

  const searchByNumberMutation = trpc.receipts.getByNumber.useQuery(
    { receiptNumber: parseInt(searchNumber, 10) || 0 },
    { enabled: false }
  );

  const handleSearch = async () => {
    if (!searchNumber.trim()) {
      toast.error("Digite um número de recibo");
      return;
    }
    const num = parseInt(searchNumber, 10);
    if (isNaN(num) || num <= 0) {
      toast.error("Número de recibo inválido");
      return;
    }
    // Primeiro tenta na lista local
    const found = receipts?.find((r: any) => r.receiptNumber === num);
    if (found) {
      setSelectedReceipt(found);
      setShowDetail(true);
      return;
    }
    // Se não encontrou localmente, busca no backend
    try {
      const result = await searchByNumberMutation.refetch();
      if (result.data) {
        setSelectedReceipt(result.data);
        setShowDetail(true);
      } else {
        toast.error(`Recibo #${num} não encontrado`);
      }
    } catch {
      toast.error(`Erro ao buscar recibo #${num}`);
    }
  };

  const formatCurrency = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;
  const formatDate = (date: string | Date) => new Date(date).toLocaleString("pt-BR");
  const formatReceiptNumber = (num: number) => num.toString().padStart(6, "0");

  const parseItems = (itemsJson: string) => {
    try {
      return JSON.parse(itemsJson);
    } catch {
      return [];
    }
  };

  const generateReceiptHTML = (receipt: any) => {
    const items = parseItems(receipt.items);
    return `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Recibo #${formatReceiptNumber(receipt.receiptNumber)} - Toca da Pantera</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; background: white; }
            .receipt { text-align: center; border: 1px solid #ccc; padding: 20px; }
            .header h1 { margin: 0; font-size: 18px; font-weight: bold; }
            .header p { margin: 5px 0; font-size: 12px; color: #666; }
            .divider { border-top: 1px dashed #ccc; margin: 15px 0; }
            .items { text-align: left; margin: 15px 0; }
            .item { display: flex; justify-content: space-between; font-size: 12px; margin: 8px 0; }
            .item-name { flex: 1; }
            .item-qty { margin: 0 10px; text-align: center; width: 30px; }
            .item-total { text-align: right; width: 80px; }
            .total-row { display: flex; justify-content: space-between; font-size: 12px; margin: 5px 0; }
            .total-final { font-size: 16px; font-weight: bold; border-top: 1px solid #ccc; padding-top: 10px; margin-top: 10px; }
            .notes { text-align: left; font-size: 11px; color: #333; margin: 10px 0; padding: 8px; background: #f9f9f9; border-radius: 4px; }
            .footer { font-size: 11px; color: #666; margin-top: 20px; }
            @media print { body { margin: 0; padding: 10px; } .receipt { border: none; } }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <img src="/logo.jpeg" style="max-width: 120px; height: auto; margin-bottom: 10px;">
              <h1>TOCA DA PANTERA</h1>
              <p>Artigos Religiosos, Esotéricos e Místicos</p>
              <p>Recibo #${formatReceiptNumber(receipt.receiptNumber)}</p>
              <p>${formatDate(receipt.createdAt)}</p>
            </div>
            <div class="divider"></div>
            <div class="items">
              <div class="item" style="font-weight: bold;">
                <div class="item-name">Produto</div>
                <div class="item-qty">Qtd</div>
                <div class="item-total">Total</div>
              </div>
              ${items.map((item: any) => `
                <div class="item">
                  <div class="item-name">${item.name}</div>
                  <div class="item-qty">${item.quantity}</div>
                  <div class="item-total">R$ ${(item.total / 100).toFixed(2)}</div>
                </div>
              `).join("")}
            </div>
            <div class="divider"></div>
            <div class="totals">
              <div class="total-row"><span>Subtotal:</span><span>R$ ${(receipt.subtotal / 100).toFixed(2)}</span></div>
              ${receipt.discount > 0 ? `<div class="total-row"><span>Desconto:</span><span>-R$ ${(receipt.discount / 100).toFixed(2)}</span></div>` : ""}
              <div class="total-row total-final"><span>TOTAL:</span><span>R$ ${(receipt.total / 100).toFixed(2)}</span></div>
            </div>
            <div class="divider"></div>
            <div class="footer">
              <p>Forma de Pagamento: ${receipt.paymentMethod.toUpperCase()}</p>
              ${receipt.notes ? `<div class="notes"><strong>Obs:</strong> ${receipt.notes}</div>` : ""}
              <p style="margin-top: 15px;">Obrigado pela compra!</p>
              <p>Volte sempre!</p>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const handlePrint = (receipt: any) => {
    const html = generateReceiptHTML(receipt);
    const printWindow = window.open("", "_blank", "width=450,height=600");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
      toast.success("Enviando para impressora...");
    } else {
      toast.error("Popup bloqueado. Permita popups para imprimir.");
    }
  };

  const handleDownload = (receipt: any) => {
    const html = generateReceiptHTML(receipt);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `recibo_${formatReceiptNumber(receipt.receiptNumber)}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Recibo baixado!");
  };

  const paymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      dinheiro: "Dinheiro",
      pix: "PIX",
      debito: "Débito",
      credito: "Crédito",
      cheque: "Cheque",
      infinitepay: "InfinitePay",
    };
    return labels[method] || method;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Receipt className="w-8 h-8 text-accent" />
            Histórico de Recibos
          </h1>
          <p className="text-muted-foreground mt-1">Consulte, reimprima ou baixe recibos anteriores</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="border-accent text-accent hover:bg-accent/10">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Search */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número do recibo..."
                value={searchNumber}
                onChange={(e) => setSearchNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 bg-background border-border text-foreground"
              />
            </div>
            <Button onClick={handleSearch} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Search className="w-4 h-4 mr-2" />
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-accent">{receipts?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Total de Recibos</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-accent">
              {receipts && receipts.length > 0 ? formatCurrency(receipts.reduce((sum: number, r: any) => sum + r.total, 0)) : "R$ 0,00"}
            </p>
            <p className="text-xs text-muted-foreground">Valor Total em Recibos</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-accent">
              {receipts && receipts.length > 0 ? `#${formatReceiptNumber(Math.max(...receipts.map((r: any) => r.receiptNumber)))}` : "-"}
            </p>
            <p className="text-xs text-muted-foreground">Último Recibo</p>
          </CardContent>
        </Card>
      </div>

      {/* Receipts Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Recibos Emitidos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando recibos...</div>
          ) : !receipts || receipts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum recibo emitido ainda</p>
              <p className="text-xs mt-1">Os recibos aparecem aqui após finalizar vendas</p>
            </div>
          ) : (
            <>
            {/* Cards no celular */}
            <div className="md:hidden space-y-2 sm:space-y-3">
              {receipts.map((receipt: any) => {
                const items = parseItems(receipt.items);
                return (
                  <div key={receipt.id} className="p-3 bg-background rounded-lg border border-border space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-sm text-foreground">
                        #{formatReceiptNumber(receipt.receiptNumber)}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDate(receipt.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-2">
                        {items.length} {items.length === 1 ? "item" : "itens"}
                        {receipt.notes && (
                          <Badge variant="outline" className="text-xs border-accent/50 text-accent">
                            Obs
                          </Badge>
                        )}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {paymentMethodLabel(receipt.paymentMethod)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-semibold text-accent">
                        {formatCurrency(receipt.total)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedReceipt(receipt); setShowDetail(true); }}
                          className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePrint(receipt)}
                          className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
                          title="Imprimir"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(receipt)}
                          className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
                          title="Baixar"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tabela no computador */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-accent text-sm font-semibold">Nº</th>
                    <th className="text-left py-3 px-2 text-accent text-sm font-semibold">Data</th>
                    <th className="text-left py-3 px-2 text-accent text-sm font-semibold">Itens</th>
                    <th className="text-left py-3 px-2 text-accent text-sm font-semibold">Pagamento</th>
                    <th className="text-right py-3 px-2 text-accent text-sm font-semibold">Total</th>
                    <th className="text-center py-3 px-2 text-accent text-sm font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((receipt: any) => {
                    const items = parseItems(receipt.items);
                    return (
                      <tr key={receipt.id} className="border-b border-border/50 hover:bg-background/50 transition-colors">
                        <td className="py-3 px-2">
                          <span className="font-mono text-sm text-foreground">#{formatReceiptNumber(receipt.receiptNumber)}</span>
                        </td>
                        <td className="py-3 px-2 text-sm text-muted-foreground">
                          {formatDate(receipt.createdAt)}
                        </td>
                        <td className="py-3 px-2 text-sm text-foreground">
                          {items.length} {items.length === 1 ? "item" : "itens"}
                          {receipt.notes && (
                            <Badge variant="outline" className="ml-2 text-xs border-accent/50 text-accent">
                              Obs
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant="secondary" className="text-xs">
                            {paymentMethodLabel(receipt.paymentMethod)}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-right font-semibold text-accent">
                          {formatCurrency(receipt.total)}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setSelectedReceipt(receipt); setShowDetail(true); }}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              title="Visualizar"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePrint(receipt)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              title="Imprimir"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(receipt)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              title="Baixar"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Recibo #{selectedReceipt && formatReceiptNumber(selectedReceipt.receiptNumber)}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {selectedReceipt && formatDate(selectedReceipt.createdAt)}
            </DialogDescription>
          </DialogHeader>

          {selectedReceipt && (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {/* Items */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-foreground grid grid-cols-3 gap-2 pb-2 border-b border-border">
                  <div>Produto</div>
                  <div className="text-center">Qtd</div>
                  <div className="text-right">Total</div>
                </div>
                {parseItems(selectedReceipt.items).map((item: any, idx: number) => (
                  <div key={idx} className="text-xs text-foreground grid grid-cols-3 gap-2">
                    <div className="truncate">{item.name}</div>
                    <div className="text-center">{item.quantity}</div>
                    <div className="text-right">{formatCurrency(item.total)}</div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-2 border-t border-b border-border py-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="text-foreground">{formatCurrency(selectedReceipt.subtotal)}</span>
                </div>
                {selectedReceipt.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Desconto:</span>
                    <span className="text-destructive">-{formatCurrency(selectedReceipt.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-foreground">TOTAL:</span>
                  <span className="text-accent">{formatCurrency(selectedReceipt.total)}</span>
                </div>
              </div>

              {/* Payment */}
              <div className="text-center text-sm text-muted-foreground">
                Pagamento: <Badge variant="secondary">{paymentMethodLabel(selectedReceipt.paymentMethod)}</Badge>
              </div>

              {/* Notes */}
              {selectedReceipt.notes && (
                <div className="bg-background border border-border rounded p-3">
                  <p className="text-xs text-muted-foreground font-semibold mb-1">Observações:</p>
                  <p className="text-xs text-foreground">{selectedReceipt.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => setShowDetail(false)} className="flex-1">
              Fechar
            </Button>
            <Button
              variant="outline"
              onClick={() => selectedReceipt && handlePrint(selectedReceipt)}
              className="flex-1"
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
            <Button
              onClick={() => selectedReceipt && handleDownload(selectedReceipt)}
              className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
