"use client"

/**
 * Ações de tela, escondidas na impressão pelo próprio CSS (.doc-toolbar).
 *
 * Client Component mínimo porque `window.print()` só existe no navegador — o resto do
 * documento permanece renderizado no servidor.
 */
export function PrintToolbar({ backHref }: { backHref: string }) {
  return (
    <div className="doc-toolbar">
      <a href={backHref}>Voltar</a>
      <button type="button" className="is-primary" onClick={() => window.print()}>
        Imprimir / Salvar PDF
      </button>
    </div>
  )
}
