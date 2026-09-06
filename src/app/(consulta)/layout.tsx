/**
 * Layout da consulta do paciente.
 *
 * Grupo de rotas próprio, e não `(app)`, por uma razão de fronteira: aqui não entra nada
 * do sistema. Sem barra lateral, sem menu, sem busca, sem notificação, sem perfil — o
 * paciente não é usuário do CSIB, é alguém que abriu um endereço para uma consulta, como
 * num Meet. O único caminho que existe nesta tela é a própria chamada.
 *
 * Também não há link de login em lugar nenhum: não existe conta para ele entrar, e
 * oferecer um formulário de funcionário a um paciente é pior do que não oferecer nada.
 */
export default function ConsultaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}
