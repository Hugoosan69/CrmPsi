import "./print.css"

/**
 * Layout dos documentos impressos: sem sidebar, sem cabeçalho, sem tema.
 *
 * Grupo de rotas próprio porque um documento clínico é uma folha A4, não uma tela do
 * sistema — o shell do app apareceria no papel. Continua protegido pelo proxy como
 * qualquer outra rota autenticada.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="doc-body">{children}</div>
}
