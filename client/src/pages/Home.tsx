import { useEffect } from "react";
import { useLocation } from "wouter";

// tocadapantera.com.br (domínio principal, bonito) leva direto pra loja;
// qualquer outro endereço (sistema.tocadapantera.com.br, localhost, etc.)
// continua caindo no painel administrativo, como sempre.
const STORE_HOSTNAMES = ["tocadapantera.com.br", "www.tocadapantera.com.br"];

export default function Home() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const isStoreDomain = STORE_HOSTNAMES.includes(window.location.hostname);
    setLocation(isStoreDomain ? "/loja/pedidos" : "/dashboard");
  }, [setLocation]);
  return null;
}
