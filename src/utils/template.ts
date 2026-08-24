/** Fills `{{placeholder}}` tokens in a document template. Shared between client (preview
 * before issuing, item 18) and any future server-side rendering — plain string logic,
 * no server-only dependency. */
export function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? "")
}
