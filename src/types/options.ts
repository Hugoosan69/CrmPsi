import type { Database } from "./supabase"

/**
 * Lightweight shapes for pickers and row actions. These lived duplicated across five
 * scheduling components (and drifted, which produced a real "two different types with
 * this name" build error) — audit finding on duplication. Single source now.
 */
export type ProfessionalOption = Pick<
  Database["public"]["Tables"]["professionals"]["Row"],
  "id" | "full_name"
>

export type ProcedureOption = Pick<
  Database["public"]["Tables"]["procedures"]["Row"],
  "id" | "name" | "duration_minutes" | "price"
>

export type SpecialtyOption = Pick<Database["public"]["Tables"]["specialties"]["Row"], "id" | "name">

export type RoleOption = Pick<Database["public"]["Tables"]["roles"]["Row"], "id" | "name">

export type PatientOption = Pick<
  Database["public"]["Tables"]["patients"]["Row"],
  "id" | "full_name" | "social_name"
>
