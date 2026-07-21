import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Upload, X, UserPlus, Users, KeyRound } from "lucide-react";

// Mesmo padrão usado no cadastro de produtos: redimensiona no navegador
// antes de mandar, pra não estourar o limite de tamanho salvo no banco.
function resizeImageFile(file: File, maxDimension = 600, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Arquivo não é uma imagem válida"));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Não foi possível processar a imagem")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function PortalAccount() {
  const utils = trpc.useUtils();
  const meQuery = trpc.portal.me.useQuery();
  const me = meQuery.data;

  const [form, setForm] = useState({ contactName: "", phone: "" });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

  useEffect(() => {
    if (me) setForm({ contactName: me.contactName ?? "", phone: me.phone ?? "" });
  }, [me]);

  const updateProfileMutation = trpc.portal.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Dados atualizados!");
      utils.portal.me.invalidate();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const uploadLogoMutation = trpc.portal.profile.uploadLogo.useMutation({
    onSuccess: () => {
      toast.success("Logo atualizada!");
      utils.portal.me.invalidate();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
    onSettled: () => setUploadingLogo(false),
  });

  const changePasswordMutation = trpc.portal.profile.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada!");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const usersQuery = trpc.portal.teamUsers.list.useQuery();
  const [newUser, setNewUser] = useState({ name: "", username: "", password: "" });

  const createUserMutation = trpc.portal.teamUsers.create.useMutation({
    onSuccess: () => {
      toast.success("Usuário adicionado!");
      setNewUser({ name: "", username: "", password: "" });
      utils.portal.teamUsers.list.invalidate();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const setUserActiveMutation = trpc.portal.teamUsers.setActive.useMutation({
    onSuccess: () => {
      toast.success("Atualizado!");
      utils.portal.teamUsers.list.invalidate();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({ contactName: form.contactName || undefined, phone: form.phone || undefined });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < 6) {
      toast.error("A nova senha precisa ter pelo menos 6 caracteres");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    changePasswordMutation.mutate({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name.trim() || !newUser.username.trim() || newUser.password.length < 6) {
      toast.error("Preencha nome, usuário e uma senha com pelo menos 6 caracteres");
      return;
    }
    createUserMutation.mutate({ name: newUser.name.trim(), username: newUser.username.trim(), password: newUser.password });
  };

  if (meQuery.isLoading) {
    return <div className="text-center py-10 text-muted-foreground text-sm">Carregando...</div>;
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-10">
      <div>
        <h1 className="text-xl sm:text-3xl font-bold text-foreground">Minha Conta</h1>
        <p className="text-muted-foreground text-sm">Dados do seu terreiro, logo, e quem mais pode acessar o Portal</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Terreiro</CardTitle>
          <CardDescription>Nome de acesso e plano são definidos pela Toca da Pantera — o resto você edita aqui</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-background border border-border overflow-hidden flex items-center justify-center shrink-0">
              {me?.logoUrl ? (
                <img src={me.logoUrl} alt="Logo do terreiro" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] text-muted-foreground text-center px-1">Sem logo</span>
              )}
            </div>
            <div className="flex gap-2">
              <label>
                <Button type="button" variant="outline" size="sm" disabled={uploadingLogo} asChild>
                  <span className="cursor-pointer">
                    {uploadingLogo ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-2" />}
                    {me?.logoUrl ? "Trocar logo" : "Enviar logo"}
                  </span>
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setUploadingLogo(true);
                    try {
                      const dataUrl = await resizeImageFile(file);
                      uploadLogoMutation.mutate({ logoUrl: dataUrl });
                    } catch (error: any) {
                      toast.error(error?.message ?? "Erro ao processar a imagem");
                      setUploadingLogo(false);
                    }
                  }}
                />
              </label>
              {me?.logoUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => uploadLogoMutation.mutate({ logoUrl: null })}
                  disabled={uploadLogoMutation.isPending}
                >
                  <X className="w-3.5 h-3.5 mr-2" />
                  Remover
                </Button>
              )}
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Nome do terreiro</Label>
              <Input value={me?.name ?? ""} disabled className="mt-1 opacity-70" />
            </div>
            <div>
              <Label>Usuário de acesso</Label>
              <Input value={me?.username ?? ""} disabled className="mt-1 opacity-70" />
            </div>
            <div>
              <Label htmlFor="contactName">Pessoa de contato</Label>
              <Input
                id="contactName"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                className="mt-1"
                placeholder="Quem cuida dos pedidos"
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? "Salvando..." : "Salvar dados"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-accent" />
            Trocar Senha
          </CardTitle>
          <CardDescription>Vale pra sua própria senha de acesso a este Portal</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="currentPassword" className="text-xs">Senha atual</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="mt-1 h-9"
                autoComplete="current-password"
              />
            </div>
            <div>
              <Label htmlFor="newPassword" className="text-xs">Nova senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="mt-1 h-9"
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword" className="text-xs">Confirme a nova senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="mt-1 h-9"
                autoComplete="new-password"
              />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" variant="outline" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? "Salvando..." : "Trocar senha"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-accent" />
            Usuários do Terreiro
          </CardTitle>
          <CardDescription>
            Cadastre mais gente pra acessar esse mesmo Portal (ex: quem cuida dos pedidos no dia a dia) — todos veem e fazem as mesmas coisas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {usersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (usersQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário adicional ainda — só o login principal</p>
          ) : (
            <div className="space-y-2">
              {(usersQuery.data ?? []).map((u: any) => (
                <div key={u.id} className="flex items-center justify-between gap-2 p-3 bg-background rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.username}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={u.isActive ? "bg-green-900/40 text-green-400 border-green-700" : "bg-red-900/40 text-red-400 border-red-700"}>
                      {u.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => setUserActiveMutation.mutate({ id: u.id, isActive: !u.isActive })}
                      disabled={setUserActiveMutation.isPending}
                    >
                      {u.isActive ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border">
            <div>
              <Label htmlFor="newUserName" className="text-xs">Nome</Label>
              <Input
                id="newUserName"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                className="mt-1 h-9"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label htmlFor="newUserUsername" className="text-xs">Usuário</Label>
              <Input
                id="newUserUsername"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                className="mt-1 h-9"
                placeholder="ex: maria-terreiro"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="newUserPassword" className="text-xs">Senha</Label>
              <Input
                id="newUserPassword"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="mt-1 h-9"
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
              />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" variant="outline" disabled={createUserMutation.isPending}>
                <UserPlus className="w-4 h-4 mr-2" />
                {createUserMutation.isPending ? "Adicionando..." : "Adicionar usuário"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
