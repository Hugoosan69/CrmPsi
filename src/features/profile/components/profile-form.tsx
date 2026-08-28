"use client"

import { useActionState } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  changePasswordAction,
  updateProfileAction,
  type ProfileActionState,
} from "../actions/profile.actions"

const initialState: ProfileActionState = {}

export function ProfileForm({
  fullName,
  email,
  phone,
  roleName,
  clinicName,
}: {
  fullName: string
  email: string
  phone: string | null
  roleName: string
  clinicName: string
}) {
  const [profileState, profileAction, isSavingProfile] = useActionState(
    updateProfileAction,
    initialState
  )
  const [passwordState, passwordAction, isSavingPassword] = useActionState(
    changePasswordAction,
    initialState
  )

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Seus dados</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={profileAction} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="profile-name">Nome completo</Label>
              <Input id="profile-name" name="full_name" defaultValue={fullName} required />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="profile-phone">Telefone</Label>
              <Input
                id="profile-phone"
                name="phone"
                defaultValue={phone ?? ""}
                placeholder="(61) 90000-0000"
                autoComplete="tel"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="profile-email">E-mail</Label>
              <Input id="profile-email" value={email} disabled readOnly />
              <p className="text-[0.75rem] text-muted-foreground">
                O e-mail é sua credencial de acesso e só a gestão pode alterá-lo, em Gestão ›
                Usuários.
              </p>
            </div>

            <dl className="grid gap-1 border-t border-border pt-3 text-[0.8rem]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Clínica</dt>
                <dd className="text-right">{clinicName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Papel</dt>
                <dd className="text-right">{roleName}</dd>
              </div>
            </dl>

            {profileState.error && (
              <p className="text-sm text-destructive" role="alert">
                {profileState.error}
              </p>
            )}
            {profileState.success && (
              <p className="text-sm text-status-success" role="status">
                {profileState.success}
              </p>
            )}

            <div>
              <Button type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? "Salvando..." : "Salvar dados"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Alterar senha</CardTitle>
        </CardHeader>
        <CardContent>
          {/* key on success resets the fields, so the typed passwords do not linger in the
              DOM after a successful change. */}
          <form action={passwordAction} className="grid gap-4" key={passwordState.success ?? "form"}>
            <div className="grid gap-1.5">
              <Label htmlFor="current-password">Senha atual</Label>
              <Input
                id="current-password"
                name="current_password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                name="new_password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <p className="text-[0.75rem] text-muted-foreground">Ao menos 8 caracteres.</p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            {passwordState.error && (
              <p className="text-sm text-destructive" role="alert">
                {passwordState.error}
              </p>
            )}
            {passwordState.success && (
              <p className="text-sm text-status-success" role="status">
                {passwordState.success}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button type="submit" disabled={isSavingPassword}>
                {isSavingPassword ? "Alterando..." : "Alterar senha"}
              </Button>
              {/* This form requires the current password on purpose (changing it without
                  proving the old one would let a hijacked session lock the owner out), which
                  leaves someone who simply does not remember it with no way forward from
                  here. The recovery flow is that way out. */}
              <Link
                href="/recuperar-senha"
                className="text-[0.8rem] text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Não lembro a senha atual
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
