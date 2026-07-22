import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { User, Package, KeyRound, LogOut, MapPin } from "lucide-react";
import { ShippingAddressForm, ShippingAddress } from "@/components/public/ShippingFields";

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

export default function AccountDashboard() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const meQuery = trpc.account.me.useQuery();
  const ordersQuery = trpc.account.orders.useQuery(undefined, { enabled: !!meQuery.data });

  const [profileForm, setProfileForm] = useState({ name: "", phone: "" });
  const [address, setAddress] = useState<ShippingAddress>({
    zipCode: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });

  useEffect(() => {
    if (!meQuery.data) return;
    setProfileForm({ name: meQuery.data.name, phone: meQuery.data.phone ?? "" });
    setAddress({
      zipCode: meQuery.data.shippingZipCode ?? "",
      street: meQuery.data.shippingStreet ?? "",
      number: meQuery.data.shippingNumber ?? "",
      complement: meQuery.data.shippingComplement ?? "",
      neighborhood: meQuery.data.shippingNeighborhood ?? "",
      city: meQuery.data.shippingCity ?? "",
      state: meQuery.data.shippingState ?? "",
    });
  }, [meQuery.data]);

  useEffect(() => {
    if (meQuery.isSuccess && !meQuery.data) {
      setLocation("/conta/entrar");
    }
  }, [meQuery.isSuccess, meQuery.data, setLocation]);

  const logoutMutation = trpc.account.logout.useMutation({
    onSuccess: () => {
      utils.account.me.invalidate();
      setLocation("/loja/produtos");
    },
  });

  const updateProfileMutation = trpc.account.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Dados atualizados!");
      utils.account.me.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const changePasswordMutation = trpc.account.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Senha atualizada!");
      setPasswordForm({ currentPassword: "", newPassword: "" });
    },
    onError: (error) => toast.error(error.message),
  });

  if (!meQuery.data) {
    return <div className="text-center py-10 text-muted-foreground">Carregando...</div>;
  }

  const orders = ordersQuery.data ?? [];

  return (
    <div className="max-w-2xl mx-auto space-y-5 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Minha Conta</h1>
        <Button variant="outline" size="sm" onClick={() => logoutMutation.mutate()}>
          <LogOut className="w-4 h-4 mr-2" /> Sair
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4 text-accent" /> Meus dados
          </CardTitle>
          <CardDescription>{meQuery.data.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateProfileMutation.mutate({ name: profileForm.name, phone: profileForm.phone, shippingAddress: address });
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="acc-name">Nome</Label>
                <Input id="acc-name" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="acc-phone">Telefone</Label>
                <Input id="acc-phone" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} className="mt-1" placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div className="pt-2 border-t border-border space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Endereço de entrega
              </Label>
              <ShippingAddressForm address={address} onChange={setAddress} idPrefix="acc" />
            </div>
            <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={updateProfileMutation.isPending}>
              {updateProfileMutation.isPending ? "Salvando..." : "Salvar dados"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="w-4 h-4 text-accent" /> {meQuery.data.hasPassword ? "Trocar senha" : "Criar senha"}
          </CardTitle>
          {meQuery.data.hasGoogle && !meQuery.data.hasPassword && (
            <CardDescription>Você entra com Google — criar uma senha é opcional.</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              changePasswordMutation.mutate(passwordForm);
            }}
            className="grid grid-cols-2 gap-3 items-end"
          >
            {meQuery.data.hasPassword && (
              <div>
                <Label htmlFor="acc-current-password">Senha atual</Label>
                <Input
                  id="acc-current-password"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="mt-1"
                />
              </div>
            )}
            <div>
              <Label htmlFor="acc-new-password">Nova senha</Label>
              <Input
                id="acc-new-password"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="mt-1"
                minLength={6}
              />
            </div>
            <Button type="submit" className="col-span-2 bg-accent text-accent-foreground hover:bg-accent/90" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending ? "Salvando..." : "Salvar senha"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="w-4 h-4 text-accent" /> Meus pedidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ordersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Você ainda não fez nenhum pedido.</p>
          ) : (
            <div className="space-y-2">
              {orders.map((order: any) => (
                <div key={order.id} className="p-3 bg-muted rounded-lg border border-border space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Pedido #{order.id}</p>
                    <Badge className={`text-[10px] ${STATUS_COLORS[order.status] ?? ""}`}>{STATUS_LABELS[order.status] ?? order.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {order.items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")}
                  </p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("pt-BR")}</span>
                    <span className="font-semibold text-accent">R$ {((order.subtotal + (order.shippingCents ?? 0)) / 100).toFixed(2)}</span>
                  </div>
                  {order.trackingCode && (
                    <p className="text-xs text-muted-foreground">Rastreio: {order.trackingCode} {order.carrier ? `(${order.carrier})` : ""}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
