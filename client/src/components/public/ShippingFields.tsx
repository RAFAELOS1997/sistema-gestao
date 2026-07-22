import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, Store, Truck } from "lucide-react";

export type ShippingMethod = "retirada" | "envio";

export type ShippingAddress = {
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

export const EMPTY_ADDRESS: ShippingAddress = {
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

// Busca endereço pelo CEP na ViaCEP (serviço público, gratuito, sem
// necessidade de chave) — só preenche rua/bairro/cidade/UF sozinho, número e
// complemento o cliente digita.
async function lookupCep(cep: string): Promise<Partial<ShippingAddress> | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return {
      street: data.logradouro || "",
      neighborhood: data.bairro || "",
      city: data.localidade || "",
      state: data.uf || "",
    };
  } catch {
    return null;
  }
}

export function ShippingMethodPicker({
  method,
  onChange,
  idPrefix,
}: {
  method: ShippingMethod;
  onChange: (method: ShippingMethod) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onChange("retirada")}
        className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
          method === "retirada" ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:bg-accent/5"
        }`}
        id={`${idPrefix}-retirada`}
      >
        <Store className="w-4 h-4" />
        Retirar na loja
      </button>
      <button
        type="button"
        onClick={() => onChange("envio")}
        className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
          method === "envio" ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:bg-accent/5"
        }`}
        id={`${idPrefix}-envio`}
      >
        <Truck className="w-4 h-4" />
        Receber em casa
      </button>
    </div>
  );
}

export function ShippingAddressForm({
  address,
  onChange,
  idPrefix,
}: {
  address: ShippingAddress;
  onChange: (address: ShippingAddress) => void;
  idPrefix: string;
}) {
  const [lookingUp, setLookingUp] = useState(false);

  const handleZipBlur = async () => {
    const digits = address.zipCode.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setLookingUp(true);
    const found = await lookupCep(address.zipCode);
    setLookingUp(false);
    if (found) {
      onChange({ ...address, ...found, state: (found.state ?? address.state).toUpperCase() });
    }
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="col-span-2 sm:col-span-1">
        <Label htmlFor={`${idPrefix}-zip`} className="text-xs flex items-center gap-1">
          <MapPin className="w-3 h-3" /> CEP
          {lookingUp && <Loader2 className="w-3 h-3 animate-spin" />}
        </Label>
        <Input
          id={`${idPrefix}-zip`}
          value={address.zipCode}
          onChange={(e) => onChange({ ...address, zipCode: e.target.value })}
          onBlur={handleZipBlur}
          className="h-9 mt-1"
          placeholder="00000-000"
          maxLength={9}
          inputMode="numeric"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <Label htmlFor={`${idPrefix}-number`} className="text-xs">Número</Label>
        <Input
          id={`${idPrefix}-number`}
          value={address.number}
          onChange={(e) => onChange({ ...address, number: e.target.value })}
          className="h-9 mt-1"
          placeholder="123"
        />
      </div>
      <div className="col-span-2">
        <Label htmlFor={`${idPrefix}-street`} className="text-xs">Rua</Label>
        <Input
          id={`${idPrefix}-street`}
          value={address.street}
          onChange={(e) => onChange({ ...address, street: e.target.value })}
          className="h-9 mt-1"
          placeholder="Preenche sozinho pelo CEP"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <Label htmlFor={`${idPrefix}-complement`} className="text-xs">Complemento (opcional)</Label>
        <Input
          id={`${idPrefix}-complement`}
          value={address.complement}
          onChange={(e) => onChange({ ...address, complement: e.target.value })}
          className="h-9 mt-1"
          placeholder="Apto, bloco..."
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <Label htmlFor={`${idPrefix}-neighborhood`} className="text-xs">Bairro</Label>
        <Input
          id={`${idPrefix}-neighborhood`}
          value={address.neighborhood}
          onChange={(e) => onChange({ ...address, neighborhood: e.target.value })}
          className="h-9 mt-1"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <Label htmlFor={`${idPrefix}-city`} className="text-xs">Cidade</Label>
        <Input
          id={`${idPrefix}-city`}
          value={address.city}
          onChange={(e) => onChange({ ...address, city: e.target.value })}
          className="h-9 mt-1"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <Label htmlFor={`${idPrefix}-state`} className="text-xs">UF</Label>
        <Input
          id={`${idPrefix}-state`}
          value={address.state}
          onChange={(e) => onChange({ ...address, state: e.target.value.toUpperCase().slice(0, 2) })}
          className="h-9 mt-1"
          placeholder="SP"
          maxLength={2}
        />
      </div>
    </div>
  );
}

export function isAddressComplete(address: ShippingAddress): boolean {
  return !!(
    address.zipCode.replace(/\D/g, "").length === 8 &&
    address.street.trim() &&
    address.number.trim() &&
    address.neighborhood.trim() &&
    address.city.trim() &&
    address.state.trim().length === 2
  );
}
