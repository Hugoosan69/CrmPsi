"use client"

import { useActionState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { loginSchema, type LoginInput } from "@/schemas/auth.schema"
import { signIn, type LoginState } from "./actions"

const initialState: LoginState = {}

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  return (
    <Form {...form}>
      <form action={formAction} className="grid gap-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input type="email" placeholder="voce@csib.com.br" autoComplete="username" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Senha</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {state.error ? (
          <p
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}
        <Button type="submit" className="mt-1 h-10 w-full" disabled={isPending}>
          {isPending ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </Form>
  )
}
