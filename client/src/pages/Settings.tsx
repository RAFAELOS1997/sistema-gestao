import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function SettingsPage() {
  const [primaryColor, setPrimaryColor] = useState("#d4af37");
  const [secondaryColor, setSecondaryColor] = useState("#1a1a1a");
  const [companyName, setCompanyName] = useState("Toca da Pantera");
  const [companyEmail, setCompanyEmail] = useState("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [logoUrl, setLogoUrl] = useState("/manus-storage/344758_ed46c05b.jpg");
  const [isSaving, setIsSaving] = useState(false);

  const configQuery = trpc.settings.getConfig.useQuery();
  const updateConfigMutation = trpc.settings.updateConfig.useMutation();
  const rolesQuery = trpc.settings.listRoles.useQuery();
  const auditLogQuery = trpc.settings.listAuditLog.useQuery({ limit: 50 });

  // Carregar configurações ao iniciar
  useEffect(() => {
    if (configQuery.data) {
      const data = configQuery.data as any;
      setCompanyName(data.companyName || "Toca da Pantera");
      setCompanyEmail(data.companyEmail || "");
      setPrimaryColor(data.primaryColor || "#d4af37");
      setSecondaryColor(data.secondaryColor || "#1a1a1a");
      setTimezone(data.timezone || "America/Sao_Paulo");
      setLogoUrl(data.logoUrl || "/manus-storage/344758_ed46c05b.jpg");
    }
  }, [configQuery.data]);

  // Aplicar cores em tempo real
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary-color", primaryColor);
    root.style.setProperty("--secondary-color", secondaryColor);
    
    const style = document.createElement("style");
    style.id = "theme-colors";
    style.textContent = `
      :root {
        --primary-color: ${primaryColor};
        --secondary-color: ${secondaryColor};
      }
      .bg-accent {
        background-color: var(--primary-color) !important;
      }
      .text-accent {
        color: var(--primary-color) !important;
      }
      .border-accent {
        border-color: var(--primary-color) !important;
      }
    `;
    
    const existingStyle = document.getElementById("theme-colors");
    if (existingStyle) {
      existingStyle.remove();
    }
    document.head.appendChild(style);
    
    return () => {
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    };
  }, [primaryColor, secondaryColor]);

  const handleUpdateConfig = async () => {
    setIsSaving(true);
    try {
      await updateConfigMutation.mutateAsync({
        companyName,
        companyEmail,
        primaryColor,
        secondaryColor,
        timezone,
        logoUrl,
      });
      toast.success("Configurações atualizadas com sucesso!");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao atualizar configurações");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <SettingsIcon className="h-8 w-8 text-accent" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
            <p className="text-muted-foreground">Personalize seu sistema e gerencie usuários</p>
          </div>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8 bg-card border border-border">
            <TabsTrigger value="general" className="text-foreground">Geral</TabsTrigger>
            <TabsTrigger value="theme" className="text-foreground">Tema</TabsTrigger>
            <TabsTrigger value="users" className="text-foreground">Usuários</TabsTrigger>
            <TabsTrigger value="permissions" className="text-foreground">Permissões</TabsTrigger>
            <TabsTrigger value="audit" className="text-foreground">Auditoria</TabsTrigger>
          </TabsList>

          {/* TAB: GERAL */}
          <TabsContent value="general">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Configurações Gerais</CardTitle>
                <CardDescription className="text-muted-foreground">Informações básicas do seu sistema</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="company-name" className="text-foreground">
                    Nome da Empresa
                  </Label>
                  <Input
                    id="company-name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="bg-background border-border text-foreground"
                    placeholder="Toca da Pantera"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company-email" className="text-foreground">
                    Email de Contato
                  </Label>
                  <Input
                    id="company-email"
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    className="bg-background border-border text-foreground"
                    placeholder="contato@tocadapantera.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone" className="text-foreground">
                    Timezone
                  </Label>
                  <select 
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
                  >
                    <option value="America/Sao_Paulo">São Paulo (UTC-3)</option>
                    <option value="America/Rio_Branco">Rio Branco (UTC-5)</option>
                    <option value="America/Manaus">Manaus (UTC-4)</option>
                    <option value="America/Recife">Recife (UTC-3)</option>
                    <option value="America/Fortaleza">Fortaleza (UTC-3)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logo-url" className="text-foreground">
                    URL da Logo
                  </Label>
                  <Input
                    id="logo-url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="bg-background border-border text-foreground"
                    placeholder="/manus-storage/logo.jpg"
                  />
                  {logoUrl && (
                    <div className="mt-2">
                      <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded-lg object-cover" />
                    </div>
                  )}
                </div>

                <Button 
                  onClick={handleUpdateConfig} 
                  disabled={isSaving}
                  className="bg-accent text-accent-foreground hover:bg-accent/90 w-full"
                >
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar Configurações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: TEMA */}
          <TabsContent value="theme">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Personalização de Tema</CardTitle>
                <CardDescription className="text-muted-foreground">Escolha as cores do seu sistema</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="primary-color" className="text-foreground">
                      Cor Primária (Dourado)
                    </Label>
                    <div className="flex gap-2">
                      <input
                        id="primary-color"
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="h-12 w-20 rounded-lg cursor-pointer border border-border"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="bg-background border-border text-foreground flex-1"
                        placeholder="#d4af37"
                      />
                    </div>
                    <div 
                      className="h-12 rounded-lg border border-border"
                      style={{ backgroundColor: primaryColor }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secondary-color" className="text-foreground">
                      Cor Secundária (Preto)
                    </Label>
                    <div className="flex gap-2">
                      <input
                        id="secondary-color"
                        type="color"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="h-12 w-20 rounded-lg cursor-pointer border border-border"
                      />
                      <Input
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="bg-background border-border text-foreground flex-1"
                        placeholder="#000000"
                      />
                    </div>
                    <div 
                      className="h-12 rounded-lg border border-border"
                      style={{ backgroundColor: secondaryColor }}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-border bg-background">
                  <p className="text-sm text-muted-foreground mb-3">Visualização em tempo real:</p>
                  <div className="flex gap-2">
                    <button 
                      className="px-4 py-2 rounded-lg text-white font-semibold transition-all"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Botão Primário
                    </button>
                    <button 
                      className="px-4 py-2 rounded-lg text-white font-semibold transition-all"
                      style={{ backgroundColor: secondaryColor }}
                    >
                      Botão Secundário
                    </button>
                  </div>
                </div>

                <Button 
                  onClick={handleUpdateConfig} 
                  disabled={isSaving}
                  className="bg-accent text-accent-foreground hover:bg-accent/90 w-full"
                >
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar Tema
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: USUÁRIOS */}
          <TabsContent value="users">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Gerenciamento de Usuários</CardTitle>
                <CardDescription className="text-muted-foreground">Controle de acesso e permissões</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Funcionalidade de gerenciamento de usuários em desenvolvimento
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: PERMISSÕES */}
          <TabsContent value="permissions">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Permissões</CardTitle>
                <CardDescription className="text-muted-foreground">Configure roles e permissões</CardDescription>
              </CardHeader>
              <CardContent>
                {rolesQuery.isLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-accent" />
                  </div>
                ) : rolesQuery.data && rolesQuery.data.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-accent font-bold">Role</TableHead>
                          <TableHead className="text-accent font-bold">Descrição</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rolesQuery.data.map((role: any) => (
                          <TableRow key={role.id} className="border-border hover:bg-background/50">
                            <TableCell className="font-medium text-foreground">{role.name}</TableCell>
                            <TableCell className="text-muted-foreground">{role.description || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma role configurada
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: AUDITORIA */}
          <TabsContent value="audit">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Log de Auditoria</CardTitle>
                <CardDescription className="text-muted-foreground">Histórico de ações no sistema</CardDescription>
              </CardHeader>
              <CardContent>
                {auditLogQuery.isLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-accent" />
                  </div>
                ) : auditLogQuery.data && auditLogQuery.data.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-accent font-bold">Ação</TableHead>
                          <TableHead className="text-accent font-bold">Usuário</TableHead>
                          <TableHead className="text-accent font-bold">Data</TableHead>
                          <TableHead className="text-accent font-bold">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogQuery.data.map((log: any) => (
                          <TableRow key={log.id} className="border-border hover:bg-background/50">
                            <TableCell className="font-medium text-foreground">{log.action}</TableCell>
                            <TableCell className="text-muted-foreground">{log.userId}</TableCell>
                            <TableCell className="text-muted-foreground">{new Date(log.timestamp).toLocaleString("pt-BR")}</TableCell>
                            <TableCell>
                              <Badge variant={log.status === "success" ? "default" : "destructive"}>
                                {log.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma ação registrada
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
