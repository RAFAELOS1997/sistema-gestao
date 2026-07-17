import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ZoomIn } from "lucide-react";

// Miniatura clicável que abre a foto ampliada num modal. Usar no lugar de
// <img> puro sempre que a foto for só pra visualização (não um botão de ação).
export function ZoomableImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={`relative block overflow-hidden group cursor-zoom-in ${className ?? ""}`}
        title="Clique para ampliar"
      >
        <img src={src} alt={alt} className="w-full h-full object-cover" loading="lazy" />
        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-2 bg-background border-border" showCloseButton>
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <img src={src} alt={alt} className="w-full h-auto max-h-[80vh] object-contain rounded" />
        </DialogContent>
      </Dialog>
    </>
  );
}
