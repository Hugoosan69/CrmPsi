import { redirect } from "next/navigation"

/** Area index (docs/ARCHITECTURE.md §7) — lands on the screen reception opens first. */
export default function RecepcaoIndex() {
  redirect("/recepcao/agenda")
}
