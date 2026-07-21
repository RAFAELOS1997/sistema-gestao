import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

// Aparece sozinho no primeiro acesso (login principal do terreiro ou de um
// usuário da equipe) — não dá pra fechar sem trocar a senha pré-cadastrada.
export function ForcePasswordChangeDialog({ open, loggedInAsName }: { open: boolean; loggedInAsName?: string }) {
  const utils = trpc.useUtils();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePasswordMutation = trpc.portal.profile.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada! Já pode usar a nova senha da próxima vez.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      utils.portal.me.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("A nova senha precisa ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm"
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-accent" />
            Troque sua senha
          </DialogTitle>
          <DialogDescription>
            {loggedInAsName ? `${loggedInAsName}, este` : "Este"} é seu primeiro acesso — por segurança, troque a
            senha que foi cadastrada pra você antes de continuar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="fpc-current">Senha atual (a que te passaram)</Label>
            <Input
              id="fpc-current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1"
              autoComplete="current-password"
            />
          </div>
          <div>
            <Label htmlFor="fpc-new">Nova senha</Label>
            <Input
              id="fpc-new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1"
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="fpc-confirm">Confirme a nova senha</Label>
            <Input
              id="fpc-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1"
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={changePasswordMutation.isPending}>
            {changePasswordMutation.isPending ? "Salvando..." : "Trocar senha e continuar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
