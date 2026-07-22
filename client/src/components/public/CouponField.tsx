import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, Tag, XCircle } from "lucide-react";

// Campo de cupom de indicação (Fase 2 do plano de expansão nacional) — o
// cliente digita o código do terreiro, a gente valida no servidor (nunca
// confia em nada calculado no navegador) e mostra se é válido.
export function CouponField({
  code,
  onChange,
  idPrefix,
}: {
  code: string;
  onChange: (code: string) => void;
  idPrefix: string;
}) {
  const [debounced, setDebounced] = useState(code);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(code.trim()), 400);
    return () => clearTimeout(t);
  }, [code]);

  const query = trpc.publicStore.coupons.validate.useQuery(
    { code: debounced },
    { enabled: debounced.length >= 3 }
  );

  return (
    <div>
      <Label htmlFor={`${idPrefix}-coupon`} className="text-xs flex items-center gap-1">
        <Tag className="w-3 h-3" /> Cupom de indicação (opcional)
      </Label>
      <div className="relative">
        <Input
          id={`${idPrefix}-coupon`}
          value={code}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 mt-1 pr-8"
          placeholder="Código do terreiro"
        />
        {debounced.length >= 3 && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5">
            {query.isFetching ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : query.data?.valid ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-destructive" />
            )}
          </span>
        )}
      </div>
      {debounced.length >= 3 && !query.isFetching && (
        <p className={`text-xs mt-1 ${query.data?.valid ? "text-green-500" : "text-destructive"}`}>
          {query.data?.valid
            ? `Cupom de ${query.data.terreiroName} — ${query.data.discountPercent}% de desconto!`
            : "Cupom não encontrado"}
        </p>
      )}
    </div>
  );
}
