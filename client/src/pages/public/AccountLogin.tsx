import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { LogIn, UserPlus } from "lucide-react";
import { GoogleSignInButton } from "@/components/public/GoogleSignInButton";

export default function AccountLogin() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const utils = trpc.useUtils();

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({ name: "", email: "", password: "", phone: "" });

  const afterAuth = () => {
    utils.account.me.invalidate();
    toast.success("Bem-vindo(a)!");
    setLocation("/conta");
  };

  const loginMutation = trpc.account.login.useMutation({
    onSuccess: afterAuth,
    onError: (error) => toast.error(error.message),
  });

  const signupMutation = trpc.account.signup.useMutation({
    onSuccess: afterAuth,
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="max-w-sm mx-auto py-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {mode === "login" ? <LogIn className="w-5 h-5 text-accent" /> : <UserPlus className="w-5 h-5 text-accent" />}
            {mode === "login" ? "Entrar" : "Criar conta"}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Acompanhe seus pedidos e agilize suas próximas compras."
              : "Leva menos de um minuto — só nome, e-mail e senha."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <GoogleSignInButton onSuccess={afterAuth} />

          {mode === "login" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loginMutation.mutate(loginForm);
              }}
              className="space-y-3"
            >
              <div>
                <Label htmlFor="login-email">E-mail</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="login-password">Senha</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="mt-1"
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                signupMutation.mutate(signupForm);
              }}
              className="space-y-3"
            >
              <div>
                <Label htmlFor="signup-name">Nome</Label>
                <Input
                  id="signup-name"
                  value={signupForm.name}
                  onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="signup-email">E-mail</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={signupForm.email}
                  onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="signup-phone">Telefone (opcional)</Label>
                <Input
                  id="signup-phone"
                  value={signupForm.phone}
                  onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })}
                  className="mt-1"
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <Label htmlFor="signup-password">Senha</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={signupForm.password}
                  onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                  className="mt-1"
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={signupMutation.isPending}>
                {signupMutation.isPending ? "Criando..." : "Criar conta"}
              </Button>
            </form>
          )}

          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="w-full text-center text-sm text-muted-foreground hover:text-accent"
          >
            {mode === "login" ? "Ainda não tem conta? Criar agora" : "Já tem conta? Entrar"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
