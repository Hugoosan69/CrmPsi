/**
 * Regras de composição da URL do webhook n8n.
 *
 * Módulo neutro (sem "use client" nem "server-only") porque as mesmas regras precisam valer
 * nos dois lados: o formulário mostra a prévia enquanto o operador digita, e o servidor
 * deriva o endereço real na hora de disparar. Duas implementações divergiriam, e o operador
 * veria na tela um endereço diferente do que seria usado.
 */

/**
 * Extrai o nome do caminho a partir do que o operador digitou.
 *
 * Colar a URL inteira que o n8n exibe é o gesto natural — o editor mostra
 * `http://host:5678/webhook-test/csib` num campo de copiar, e é isso que a pessoa cola. Sem
 * esta normalização o valor era concatenado outra vez, produzindo
 * `.../webhook/http://host:5678/webhook-test/csib`.
 *
 * Aceita: "csib", "/csib", "webhook/csib", "webhook-test/csib" e a URL completa de qualquer
 * um dos dois modos.
 */
export function normalizeWebhookPath(raw: string): string {
  let value = raw.trim()
  if (!value) return ""

  // URL completa: fica só com o caminho.
  const asUrl = value.match(/^https?:\/\/[^/]+(\/.*)?$/i)
  if (asUrl) value = asUrl[1] ?? ""

  return value
    .replace(/^\/+/, "")
    // O prefixo é decidido pelo modo (produção x teste), então nunca faz parte do nome.
    .replace(/^webhook-test\//i, "")
    .replace(/^webhook\//i, "")
    .replace(/\/+$/, "")
}

/** Servidor sem barra final. */
export function normalizeServerUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "")
}

/**
 * Os dois endereços que o n8n expõe para o mesmo nó. Diferem só no prefixo: `/webhook-test/`
 * só responde enquanto o editor está com "Listen for test event" ligado, e `/webhook/` só
 * existe depois do workflow estar ativo.
 */
export function composeWebhookUrls(server: string, path: string) {
  const base = normalizeServerUrl(server)
  const name = normalizeWebhookPath(path)
  if (!base || !name) return null
  return {
    production: `${base}/webhook/${name}`,
    test: `${base}/webhook-test/${name}`,
  }
}

/**
 * Converte uma URL completa já gravada para o modo pedido.
 *
 * Configurações salvas antes de existirem os campos separados guardam só a URL inteira, e
 * devolvê-la igual nos dois modos fazia "Testar URL de teste" bater em /webhook/ — o editor
 * do n8n ficava escutando em /webhook-test/ e nunca recebia nada, o que parece falha de
 * rede e é só endereço errado.
 */
export function switchWebhookMode(url: string, mode: "production" | "test"): string {
  const value = url.trim()
  if (!value) return ""
  return mode === "test"
    ? value.replace(/\/webhook\//, "/webhook-test/")
    : value.replace(/\/webhook-test\//, "/webhook/")
}
