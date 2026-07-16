import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, Printer } from "lucide-react";
import { toast } from "sonner";

interface CartItem {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  notes?: string;
  receiptNumber?: number;
}

export function ReceiptModal({
  isOpen,
  onClose,
  items,
  subtotal,
  discount,
  total,
  paymentMethod,
  notes,
  receiptNumber: propReceiptNumber,
}: ReceiptModalProps) {
  const receiptNumber = propReceiptNumber
    ? propReceiptNumber.toString().padStart(6, "0")
    : Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
  const receiptDate = new Date().toLocaleString("pt-BR");

  const generateReceiptHTML = () => {
    return `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Recibo #${receiptNumber} - Toca da Pantera</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 400px;
              margin: 0 auto;
              padding: 20px;
              background: white;
            }
            .receipt {
              text-align: center;
              border: 1px solid #ccc;
              padding: 20px;
            }
            .logo {
              max-width: 150px;
              margin: 0 auto 20px;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .header h1 {
              margin: 0;
              font-size: 18px;
              font-weight: bold;
            }
            .header p {
              margin: 5px 0;
              font-size: 12px;
              color: #666;
            }
            .divider {
              border-top: 1px dashed #ccc;
              margin: 15px 0;
            }
            .items {
              text-align: left;
              margin: 15px 0;
            }
            .item {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              margin: 8px 0;
            }
            .item-name {
              flex: 1;
            }
            .item-qty {
              margin: 0 10px;
              text-align: center;
              width: 30px;
            }
            .item-total {
              text-align: right;
              width: 80px;
            }
            .totals {
              margin: 15px 0;
              text-align: right;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              margin: 5px 0;
            }
            .total-final {
              font-size: 16px;
              font-weight: bold;
              border-top: 1px solid #ccc;
              padding-top: 10px;
              margin-top: 10px;
            }
            .notes {
              text-align: left;
              font-size: 11px;
              color: #333;
              margin: 10px 0;
              padding: 8px;
              background: #f9f9f9;
              border-radius: 4px;
            }
            .footer {
              font-size: 11px;
              color: #666;
              margin-top: 20px;
            }
            @media print {
              body { margin: 0; padding: 10px; }
              .receipt { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="logo">
              <img src="/manus-storage/344758_ed46c05b_90c36b27.jpg" style="max-width: 100%; height: auto;">
            </div>
            <div class="header">
              <h1>TOCA DA PANTERA</h1>
              <p>Artigos Religiosos, Esotéricos e Místicos</p>
              <p>Recibo #${receiptNumber}</p>
              <p>${receiptDate}</p>
            </div>
            
            <div class="divider"></div>
            
            <div class="items">
              <div class="item" style="font-weight: bold;">
                <div class="item-name">Produto</div>
                <div class="item-qty">Qtd</div>
                <div class="item-total">Total</div>
              </div>
              ${items
                .map(
                  (item) => `
                <div class="item">
                  <div class="item-name">${item.name}</div>
                  <div class="item-qty">${item.quantity}</div>
                  <div class="item-total">R$ ${(item.total / 100).toFixed(2)}</div>
                </div>
              `
                )
                .join("")}
            </div>
            
            <div class="divider"></div>
            
            <div class="totals">
              <div class="total-row">
                <span>Subtotal:</span>
                <span>R$ ${(subtotal / 100).toFixed(2)}</span>
              </div>
              ${
                discount > 0
                  ? `
                <div class="total-row">
                  <span>Desconto:</span>
                  <span>-R$ ${(discount / 100).toFixed(2)}</span>
                </div>
              `
                  : ""
              }
              <div class="total-row total-final">
                <span>TOTAL:</span>
                <span>R$ ${(total / 100).toFixed(2)}</span>
              </div>
            </div>
            
            <div class="divider"></div>
            
            <div class="footer">
              <p>Forma de Pagamento: ${paymentMethod.toUpperCase()}</p>
              ${notes ? `<div class="notes"><strong>Obs:</strong> ${notes}</div>` : ""}
              <p style="margin-top: 15px;">Obrigado pela compra!</p>
              <p>Volte sempre!</p>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const handleDownload = () => {
    try {
      const receiptContent = generateReceiptHTML();
      const blob = new Blob([receiptContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `recibo_${receiptNumber}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Recibo baixado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar recibo:", error);
      toast.error("Erro ao baixar recibo");
    }
  };

  const handlePrint = () => {
    try {
      const receiptContent = generateReceiptHTML();
      const printWindow = window.open("", "_blank", "width=450,height=600");
      if (printWindow) {
        printWindow.document.write(receiptContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 300);
        toast.success("Enviando para impressora...");
      } else {
        toast.error("Popup bloqueado. Permita popups para imprimir.");
      }
    } catch (error) {
      console.error("Erro ao imprimir recibo:", error);
      toast.error("Erro ao imprimir recibo");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Recibo de Venda #{receiptNumber}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Venda registrada com sucesso
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {/* Logo */}
          <div className="flex justify-center">
            <img
              src="/manus-storage/344758_ed46c05b_90c36b27.jpg"
              alt="Logo Toca da Pantera"
              className="w-28 h-28 object-contain"
            />
          </div>

          {/* Header */}
          <div className="text-center border-b border-border pb-3">
            <h2 className="text-lg font-bold text-foreground">TOCA DA PANTERA</h2>
            <p className="text-xs text-muted-foreground">Artigos Religiosos, Esotéricos e Místicos</p>
            <p className="text-xs text-muted-foreground mt-2">Recibo #{receiptNumber}</p>
            <p className="text-xs text-muted-foreground">{receiptDate}</p>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-foreground grid grid-cols-3 gap-2 pb-2 border-b border-border">
              <div>Produto</div>
              <div className="text-center">Qtd</div>
              <div className="text-right">Total</div>
            </div>
            {items.map((item) => (
              <div key={item.productId} className="text-xs text-foreground grid grid-cols-3 gap-2">
                <div className="truncate">{item.name}</div>
                <div className="text-center">{item.quantity}</div>
                <div className="text-right">R$ {(item.total / 100).toFixed(2)}</div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-2 border-t border-b border-border py-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="text-foreground font-semibold">R$ {(subtotal / 100).toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Desconto:</span>
                <span className="text-destructive font-semibold">-R$ {(discount / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold">
              <span className="text-foreground">TOTAL:</span>
              <span className="text-accent">R$ {(total / 100).toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="text-center text-xs text-muted-foreground">
            <p>Forma de Pagamento: {paymentMethod.toUpperCase()}</p>
          </div>

          {/* Notes */}
          {notes && (
            <div className="bg-background border border-border rounded p-3">
              <p className="text-xs text-muted-foreground font-semibold mb-1">Observações:</p>
              <p className="text-xs text-foreground">{notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground border-t border-border pt-3">
            <p>Obrigado pela compra!</p>
            <p>Volte sempre!</p>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-border text-foreground hover:bg-background"
          >
            <X className="w-4 h-4 mr-2" />
            Fechar
          </Button>
          <Button
            variant="outline"
            onClick={handlePrint}
            className="flex-1 border-border text-foreground hover:bg-background"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
          <Button
            onClick={handleDownload}
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Download className="w-4 h-4 mr-2" />
            Baixar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
