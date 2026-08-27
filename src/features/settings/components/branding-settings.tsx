"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveBrandingAction, type SettingsActionState } from "../actions/settings.actions"

const initialState: SettingsActionState = {}

/**
 * The logo is shown against the login screen's own deep petrol backdrop, not against the
 * app's light canvas — previewing it on white would hide exactly the problem operators hit
 * (a dark logo that vanishes on the login page).
 */
export function BrandingSettings({ logoUrl }: { logoUrl: string | null }) {
  const [state, formAction, isPending] = useActionState(saveBrandingAction, initialState)
  const [preview, setPreview] = useState<string | null>(logoUrl)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Logo da tela de login</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5 lg:grid-cols-[1fr_15rem]">
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="branding-file">Enviar arquivo</Label>
              <Input
                id="branding-file"
                name="logo_file"
                type="file"
                accept="image/svg+xml,image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) setPreview(URL.createObjectURL(file))
                }}
              />
              <p className="text-[0.75rem] text-muted-foreground">
                SVG, PNG, JPEG ou WebP, até 2 MB. SVG é o ideal — a logo aparece em tamanhos
                diferentes no login e no cabeçalho.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="branding-url">Ou informar uma URL</Label>
              <Input
                id="branding-url"
                name="logo_url"
                defaultValue={logoUrl ?? ""}
                placeholder="/branding/csib-logo.svg"
                onChange={(event) => setPreview(event.target.value || null)}
              />
              <p className="text-[0.75rem] text-muted-foreground">
                Usado só quando nenhum arquivo é enviado. Deixe vazio para voltar à logo
                padrão do sistema.
              </p>
            </div>

            {state.error && (
              <p className="text-sm text-destructive" role="alert">
                {state.error}
              </p>
            )}
            {state.success && (
              <p className="text-sm text-status-success" role="status">
                {state.success}
              </p>
            )}

            <div>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : "Salvar logo"}
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <p className="text-[0.75rem] font-medium text-muted-foreground">
              Prévia sobre o fundo do login
            </p>
            <div className="flex h-36 items-center justify-center rounded-lg border border-border bg-[#082B41] px-6">
              {preview ? (
                // Deliberately a plain <img>: the URL is operator-supplied and can point at
                // any host, which next/image would reject without remotePatterns config.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt="Prévia da logo"
                  className="max-h-20 max-w-full object-contain"
                />
              ) : (
                <p className="text-center text-[0.75rem] text-white/50">
                  Sem logo definida — o login usa a logo padrão do sistema.
                </p>
              )}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
