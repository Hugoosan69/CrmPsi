"use client"

import { useState } from "react"
import {
  CarouselLayout,
  ConnectionStateToast,
  FocusLayoutContainer,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  TrackToggle,
  useLocalParticipant,
  useRoomContext,
  useTracks,
} from "@livekit/components-react"
import { ConnectionState, Track } from "livekit-client"
import type { ToggleSource } from "@livekit/components-core"
import { Mic, MicOff, MonitorUp, PhoneOff, Video, VideoOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { StatusDot } from "@/components/shared/status-dot"
import { cn } from "@/lib/utils"

/**
 * O palco da consulta: grade de vídeo + controles, no estilo do sistema.
 *
 * Substitui o `VideoConference` pronto do LiveKit. Ele funciona, mas vem em inglês, com o
 * tema escuro do próprio LiveKit, e nada ali se parece com o resto do CSIB — numa tela que
 * o paciente abre sozinho, por um link, isso lê como "outro produto", que é justamente o
 * que uma consulta não pode parecer.
 *
 * O que se ganha montando à mão: rótulos em português, os tokens de cor do sistema, e
 * controle sobre o que existe na tela (o paciente não precisa de nada além de microfone,
 * câmera e sair).
 */
export function CallStage({
  onLeave,
  canShareScreen = true,
}: {
  onLeave: () => void
  /** O paciente não compartilha tela — é ruído numa consulta, e um risco a menos. */
  canShareScreen?: boolean
}) {
  const room = useRoomContext()
  const { localParticipant } = useLocalParticipant()
  const [saindo, setSaindo] = useState(false)

  // `onlySubscribed: false` inclui a própria câmera antes de publicar, então a pessoa se vê
  // na tela desde o primeiro instante em vez de olhar para um retângulo vazio.
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  )

  const compartilhando = tracks.filter((t) => t.source === Track.Source.ScreenShare)
  const cameras = tracks.filter((t) => t.source === Track.Source.Camera)
  const emApresentacao = compartilhando.length > 0

  const conectando =
    room.state === ConnectionState.Connecting || room.state === ConnectionState.Reconnecting

  async function sair() {
    setSaindo(true)
    await room.disconnect()
    onLeave()
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-[#0d1117]">
      {/* Reconexão é o estado que mais assusta em chamada: dizer o que está havendo evita
          que a pessoa desligue achando que caiu. */}
      {conectando && (
        <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-2">
          <StatusDot
            tone="warning"
            pulse
            label={
              room.state === ConnectionState.Reconnecting
                ? "Reconectando — não feche a janela"
                : "Conectando..."
            }
          />
        </div>
      )}

      <div className="min-h-0 flex-1 p-2">
        {emApresentacao ? (
          // Alguém compartilhando tela: ela domina, e as câmeras viram uma fita ao lado.
          <FocusLayoutContainer className="h-full">
            <CarouselLayout tracks={cameras}>
              <ParticipantTile />
            </CarouselLayout>
            <ParticipantTile trackRef={compartilhando[0]} />
          </FocusLayoutContainer>
        ) : (
          <GridLayout tracks={cameras} className="h-full">
            <ParticipantTile />
          </GridLayout>
        )}
      </div>

      {/* O áudio dos outros participantes não sai de lugar nenhum sem isto. */}
      <RoomAudioRenderer />
      <ConnectionStateToast />

      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-black/40 px-4 py-3">
        <ControlePrimario
          source={Track.Source.Microphone}
          ligado={localParticipant.isMicrophoneEnabled}
          IconeLigado={Mic}
          IconeDesligado={MicOff}
          rotulo="Microfone"
        />
        <ControlePrimario
          source={Track.Source.Camera}
          ligado={localParticipant.isCameraEnabled}
          IconeLigado={Video}
          IconeDesligado={VideoOff}
          rotulo="Câmera"
        />
        {canShareScreen && (
          <ControlePrimario
            source={Track.Source.ScreenShare}
            ligado={localParticipant.isScreenShareEnabled}
            IconeLigado={MonitorUp}
            IconeDesligado={MonitorUp}
            rotulo="Tela"
          />
        )}

        <Button variant="destructive" onClick={sair} disabled={saindo} className="ml-2">
          <PhoneOff className="size-4" aria-hidden />
          {saindo ? "Saindo..." : "Sair"}
        </Button>
      </div>
    </div>
  )
}

/**
 * Um botão de mídia.
 *
 * `TrackToggle` cuida da parte difícil — pedir permissão, publicar e despublicar a faixa —
 * e aqui só se troca a aparência. Cor e ícone dizem a mesma coisa duas vezes, porque num
 * controle de microfone confundir ligado com desligado é o erro mais caro da tela.
 */
function ControlePrimario({
  source,
  ligado,
  IconeLigado,
  IconeDesligado,
  rotulo,
}: {
  /** `ToggleSource` é o subconjunto que o `TrackToggle` sabe ligar e desligar — câmera,
   *  microfone e tela. Tipar assim impede passar uma fonte que ele ignoraria em silêncio. */
  source: ToggleSource
  ligado: boolean
  IconeLigado: typeof Mic
  IconeDesligado: typeof MicOff
  rotulo: string
}) {
  const Icone = ligado ? IconeLigado : IconeDesligado
  return (
    <TrackToggle
      source={source}
      showIcon={false}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[0.85rem] font-medium transition-colors",
        ligado
          ? "bg-white/10 text-white hover:bg-white/15"
          : "bg-status-danger/85 text-white hover:bg-status-danger"
      )}
      aria-label={`${rotulo}: ${ligado ? "ligado" : "desligado"}`}
    >
      <Icone className="size-4" aria-hidden />
      <span className="hidden sm:inline">{rotulo}</span>
    </TrackToggle>
  )
}

/**
 * Falha de dispositivo em linguagem de gente.
 *
 * `NotReadableError` foi o que apareceu no primeiro teste real: a câmera existe e a
 * permissão foi dada, mas outro programa está com ela. É diferente de permissão negada e
 * de não ter câmera nenhuma, e as três se resolvem de formas diferentes — por isso a tela
 * separa em vez de dizer "erro ao acessar a câmera".
 */
export function mensagemDeFalhaDeMidia(erro: unknown): string {
  const nome = (erro as { name?: string } | null)?.name
  if (nome === "NotAllowedError") {
    return "O navegador bloqueou a câmera ou o microfone. Clique no cadeado ao lado do endereço e permita o acesso."
  }
  if (nome === "NotFoundError" || nome === "OverconstrainedError") {
    return "Nenhuma câmera ou microfone encontrado. Conecte um dispositivo e recarregue a página."
  }
  if (nome === "NotReadableError") {
    return "A câmera está em uso por outro programa. Feche o outro aplicativo (ou a outra aba) e recarregue a página."
  }
  return "Não foi possível acessar a câmera ou o microfone. Verifique as permissões do navegador."
}
