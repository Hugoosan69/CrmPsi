import { redirect } from "next/navigation"

/** Area index (docs/ARCHITECTURE.md §7). */
export default function GestaoIndex() {
  redirect("/gestao/financeiro")
}
