import { redirect } from "next/navigation"

/**
 * A configuração da agenda mudou de lugar: virou aba dentro de Gestão › Profissionais, que
 * é onde ela é procurada — cadastra-se o profissional e define-se o horário na mesma
 * sentada.
 *
 * A rota fica de pé como redirecionamento em vez de ser apagada. Ela esteve na barra
 * lateral, então está em favorito e em histórico de navegador de quem usa o sistema todo
 * dia; apagá-la trocaria o item de menu por um 404.
 */
export default function AgendaSettingsPage() {
  redirect("/gestao/profissionais?aba=horarios")
}
