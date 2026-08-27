import { redirect } from "next/navigation"

/** Area index (docs/ARCHITECTURE.md §7) — the professional's day starts on the agenda. */
export default function ProfissionalIndex() {
  redirect("/profissional/agenda")
}
