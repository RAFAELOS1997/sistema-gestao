import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// Contrato de comodato exibido antes de toda solicitação de produtos —
// lista os itens escolhidos e exige aceite explícito (checkbox no rodapé)
// antes de liberar o botão de enviar. O servidor NUNCA aceita a solicitação
// sem `termsAccepted: true`, então esse aceite é sempre validado de novo lá.
export function ComodatoContract({
  terreiroName,
  items,
  accepted,
  onAcceptedChange,
}: {
  terreiroName: string;
  items: { name: string; quantity: number }[];
  accepted: boolean;
  onAcceptedChange: (value: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <img src="/logo.jpeg" alt="Toca da Pantera" className="h-12 w-12 rounded-lg object-cover ring-1 ring-[#c9a961]/40 shrink-0" />
        <div>
          <p className="font-bold text-foreground leading-tight">Toca da Pantera</p>
          <p className="text-xs text-muted-foreground">Contrato de Comodato de Produtos</p>
        </div>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p><span className="font-semibold text-foreground">Comodante:</span> Toca da Pantera, artigos umbandistas e religiosos, Ribeirão Preto-SP.</p>
        <p><span className="font-semibold text-foreground">Comodatário(a):</span> {terreiroName}.</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-foreground mb-1.5">Objeto do comodato — itens solicitados:</p>
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted text-muted-foreground">
                <th className="text-left px-2 py-1.5 font-medium">Produto</th>
                <th className="text-right px-2 py-1.5 font-medium">Qtd.</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-t border-border">
                  <td className="px-2 py-1.5 text-foreground">{item.name}</td>
                  <td className="px-2 py-1.5 text-right text-foreground">{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          O valor combinado de cada item é informado pela Toca da Pantera no momento da entrega.
        </p>
      </div>

      <div className="text-xs text-muted-foreground space-y-2.5 max-h-56 overflow-y-auto pr-1 border border-border rounded-md p-3 bg-muted/40">
        <p><span className="font-semibold text-foreground">Cláusula 1ª — Do objeto.</span> Este contrato tem por objeto o empréstimo gratuito, em regime de comodato, dos produtos listados acima, de propriedade da Comodante, entregues à Comodatária para exposição e revenda em seu estabelecimento.</p>
        <p><span className="font-semibold text-foreground">Cláusula 2ª — Da responsabilidade e guarda.</span> A partir do recebimento, a Comodatária torna-se integralmente responsável pela guarda, conservação e segurança dos itens, devendo mantê-los em condições adequadas até a venda ou devolução.</p>
        <p><span className="font-semibold text-foreground">Cláusula 3ª — Dos danos, avarias e extravios.</span> Em caso de dano, avaria, quebra, extravio ou perda de qualquer item, por qualquer motivo, a Comodatária se compromete a pagar à Comodante o valor integral do produto, conforme valor combinado na entrega. <span className="font-semibold text-foreground">Não será exigida nem aceita a devolução do produto danificado, avariado ou incompleto em substituição ao pagamento</span> — o pagamento do valor integral é a única forma de quitação nessas hipóteses.</p>
        <p><span className="font-semibold text-foreground">Cláusula 4ª — Da venda e prestação de contas.</span> A Comodatária pode comercializar os produtos pelo preço que julgar adequado, ficando com a diferença entre o valor de venda e o valor combinado com a Comodante. Ao vender um item, a Comodatária deve repassar à Comodante exclusivamente o valor previamente combinado por unidade.</p>
        <p><span className="font-semibold text-foreground">Cláusula 5ª — Da devolução.</span> Os produtos não vendidos podem ser devolvidos à Comodante a qualquer momento, em perfeito estado de conservação, encerrando o comodato daquele(s) item(ns) sem qualquer ônus para a Comodatária.</p>
        <p><span className="font-semibold text-foreground">Cláusula 6ª — Do prazo.</span> Este comodato vigora por prazo indeterminado, permanecendo em vigor até que os produtos sejam vendidos (com o devido repasse à Comodante), devolvidos, ou pagos em caso de dano/extravio, nos termos deste contrato.</p>
        <p><span className="font-semibold text-foreground">Cláusula 7ª — Do aceite eletrônico.</span> Este contrato é celebrado eletronicamente, sendo válido e vinculante entre as partes a partir do aceite manifestado pela Comodatária no sistema de gestão da Comodante, no momento da solicitação dos produtos.</p>
        <p><span className="font-semibold text-foreground">Cláusula 8ª — Do foro.</span> Fica eleito o foro da comarca de Ribeirão Preto-SP para dirimir quaisquer dúvidas ou litígios oriundos deste contrato.</p>
      </div>

      <div className="flex items-start gap-2.5 pt-2 border-t border-border">
        <Checkbox id="comodato-terms" checked={accepted} onCheckedChange={(v) => onAcceptedChange(v === true)} className="mt-0.5" />
        <Label htmlFor="comodato-terms" className="text-xs font-normal leading-snug cursor-pointer">
          Li e aceito os termos e condições do contrato de comodato acima.
        </Label>
      </div>
    </div>
  );
}
