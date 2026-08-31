/**
 * Toque de chamada, sintetizado na hora pela Web Audio API.
 *
 * Sem arquivo de áudio de propósito. Um .mp3 seria mais um binário no repositório, mais um
 * pedido de rede que pode falhar justamente quando a chamada acontece, e mais uma coisa para
 * a política de conteúdo da página liberar. Duas notas de senoide resolvem, tocam offline e
 * pesam zero.
 *
 * Duas notas ascendentes (lá 880 Hz → dó# 1109 Hz), curtas, com envelope suave. O envelope
 * não é enfeite: uma senoide que começa e para em amplitude cheia produz um estalo audível
 * nas duas pontas, que numa recepção soa como defeito.
 */

const NOTAS = [
  { hz: 880, atraso: 0, duracao: 0.16 },
  { hz: 1109, atraso: 0.15, duracao: 0.28 },
]

const VOLUME = 0.16

type Ctx = AudioContext & { _csibDestravado?: boolean }

let contexto: Ctx | null = null

function obterContexto(): Ctx | null {
  if (typeof window === "undefined") return null
  if (contexto) return contexto

  // webkitAudioContext continua sendo o nome em Safari mais antigo.
  const Construtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Construtor) return null

  try {
    contexto = new Construtor() as Ctx
    return contexto
  } catch {
    return null
  }
}

/**
 * Prepara o áudio no primeiro toque, clique ou tecla da pessoa.
 *
 * Navegador nenhum deixa uma página tocar som antes de alguma interação — o contexto nasce
 * "suspended" e um `play` nesse estado não faz nada e não avisa. Como a chamada chega sem
 * aviso, e pode chegar antes de a recepcionista ter clicado em qualquer coisa naquela aba, o
 * destravamento é agendado assim que a tela monta e acontece na primeira interação, qualquer
 * que seja ela.
 *
 * Devolve a função de limpeza dos ouvintes.
 */
export function prepararToque(): () => void {
  const ctx = obterContexto()
  if (!ctx) return () => {}

  function destravar() {
    if (ctx!._csibDestravado) return
    ctx!.resume().then(
      () => {
        ctx!._csibDestravado = true
      },
      () => {
        // Navegador recusou; o pop-up e a notificação seguem valendo.
      }
    )
  }

  const eventos = ["pointerdown", "keydown", "touchstart"] as const
  for (const evento of eventos) {
    window.addEventListener(evento, destravar, { once: false, passive: true })
  }
  return () => {
    for (const evento of eventos) window.removeEventListener(evento, destravar)
  }
}

/** True quando o som de fato pode sair — a tela usa isto para avisar quando não pode. */
export function toqueDisponivel(): boolean {
  const ctx = obterContexto()
  return Boolean(ctx && ctx.state === "running")
}

/**
 * Toca o aviso. Nunca lança: falhar em tocar não pode derrubar a tela que avisa a chamada,
 * que é o que realmente importa.
 */
export function tocarChamada(): void {
  const ctx = obterContexto()
  if (!ctx) return

  try {
    // Uma última tentativa de retomar: a aba pode ter ficado em segundo plano, o que suspende
    // o contexto mesmo depois de destravado.
    if (ctx.state === "suspended") void ctx.resume()

    const agora = ctx.currentTime
    for (const nota of NOTAS) {
      const oscilador = ctx.createOscillator()
      const ganho = ctx.createGain()
      oscilador.type = "sine"
      oscilador.frequency.value = nota.hz

      const inicio = agora + nota.atraso
      const fim = inicio + nota.duracao
      ganho.gain.setValueAtTime(0, inicio)
      ganho.gain.linearRampToValueAtTime(VOLUME, inicio + 0.015)
      // Decaimento exponencial até quase zero — `0` é inválido para esta rampa.
      ganho.gain.exponentialRampToValueAtTime(0.0001, fim)

      oscilador.connect(ganho).connect(ctx.destination)
      oscilador.start(inicio)
      oscilador.stop(fim + 0.02)
    }
  } catch {
    // Silêncio é aceitável; erro na tela não.
  }
}
