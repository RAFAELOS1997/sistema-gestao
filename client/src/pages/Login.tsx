import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Login() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();

  const { data: needsSetup, isLoading: checkingSetup } = trpc.auth.needsSetup.useQuery();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setLocation("/dashboard");
    },
    onError: (error) => {
      toast.error(error.message || "Email ou senha inválidos");
    },
  });

  const setupMutation = trpc.auth.setup.useMutation({
    onSuccess: async () => {
      toast.success("Administrador criado com sucesso!");
      await utils.auth.me.invalidate();
      setLocation("/dashboard");
    },
    onError: (error) => {
      toast.error(error.message || "Não foi possível criar o administrador");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha email e senha");
      return;
    }
    if (needsSetup) {
      if (!name) {
        toast.error("Preencha o nome");
        return;
      }
      setupMutation.mutate({ name, email, password });
    } else {
      loginMutation.mutate({ email, password });
    }
  };

  const isPending = loginMutation.isPending || setupMutation.isPending;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="text-5xl mb-2">🐆</div>
          <CardTitle>Toca da Pantera</CardTitle>
          <CardDescription>
            {checkingSetup
              ? "Carregando..."
              : needsSetup
                ? "Primeiro acesso: crie a conta de administrador"
                : "Entre com seu email e senha"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {needsSetup && (
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                autoComplete="username"
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={needsSetup ? "Mínimo 6 caracteres" : "Sua senha"}
                autoComplete={needsSetup ? "new-password" : "current-password"}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={isPending || checkingSetup}
            >
              {isPending ? "Processando..." : needsSetup ? "Criar administrador" : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
