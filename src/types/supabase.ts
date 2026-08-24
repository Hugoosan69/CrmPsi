// Hand-written to match database/*/schema.sql while no live Supabase project is connected.
// Once connected, regenerate with:
//   npx supabase gen types typescript --project-id <id> > src/types/supabase.ts
// and reconcile any drift against database/*/schema.sql (that folder stays the source of truth).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "cancelled"
  | "no_show"
  | "completed"

export type QueueEntryType = "scheduled" | "walk_in" | "fit_in" | "transfer"
export type QueueStatus =
  | "payment_pending"
  | "released"
  | "waiting"
  | "called"
  | "in_service"
  | "paused"
  | "completed"
  | "cancelled"

export type ServiceEventType = "start" | "pause" | "resume" | "finish"

export type ClinicalDocumentType =
  | "atestado"
  | "declaracao"
  | "relatorio"
  | "encaminhamento"
  | "outros"

export type FinancialTransactionType = "receita" | "despesa"
export type FinancialTransactionStatus =
  | "pendente"
  | "pago"
  | "atrasado"
  | "cancelado"

export type MessageChannel = "whatsapp" | "sms" | "email"
export type MessageType =
  | "confirmation"
  | "reminder"
  | "birthday"
  | "post_visit"
  | "general"
export type MessageStatus = "queued" | "sent" | "failed" | "skipped"

export interface Database {
  public: {
    Tables: {
      clinics: {
        Row: {
          id: string
          name: string
          legal_name: string | null
          slug: string
          logo_url: string | null
          mascot_url: string | null
          primary_color: string
          secondary_color: string
          phone: string | null
          email: string | null
          address: Json | null
          timezone: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["clinics"]["Row"]> & {
          name: string
          slug: string
        }
        Update: Partial<Database["public"]["Tables"]["clinics"]["Row"]>
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          phone: string | null
          avatar_url: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string
          full_name: string
          email: string
        }
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>
        Relationships: []
      }
      roles: {
        Row: {
          id: string
          clinic_id: string | null
          slug: string
          name: string
          description: string | null
          is_system: boolean
          created_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["roles"]["Row"]> & {
          slug: string
          name: string
        }
        Update: Partial<Database["public"]["Tables"]["roles"]["Row"]>
        Relationships: []
      }
      permissions: {
        Row: {
          id: string
          slug: string
          module: string
          description: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["permissions"]["Row"]> & {
          slug: string
          module: string
        }
        Update: Partial<Database["public"]["Tables"]["permissions"]["Row"]>
        Relationships: []
      }
      role_permissions: {
        Row: { role_id: string; permission_id: string }
        Insert: { role_id: string; permission_id: string }
        Update: Partial<{ role_id: string; permission_id: string }>
        Relationships: []
      }
      clinic_memberships: {
        Row: {
          id: string
          clinic_id: string
          user_id: string
          role_id: string
          active: boolean
          created_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["clinic_memberships"]["Row"]> & {
          clinic_id: string
          user_id: string
          role_id: string
        }
        Update: Partial<Database["public"]["Tables"]["clinic_memberships"]["Row"]>
        Relationships: []
      }
      specialties: {
        Row: {
          id: string
          clinic_id: string
          name: string
          description: string | null
          active: boolean
          created_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["specialties"]["Row"]> & {
          clinic_id: string
          name: string
        }
        Update: Partial<Database["public"]["Tables"]["specialties"]["Row"]>
        Relationships: []
      }
      professionals: {
        Row: {
          id: string
          clinic_id: string
          user_id: string | null
          full_name: string
          professional_register: string | null
          specialty_id: string | null
          phone: string | null
          email: string | null
          color: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["professionals"]["Row"]> & {
          clinic_id: string
          full_name: string
        }
        Update: Partial<Database["public"]["Tables"]["professionals"]["Row"]>
        Relationships: []
      }
      patients: {
        Row: {
          id: string
          clinic_id: string
          full_name: string
          social_name: string | null
          cpf: string | null
          birth_date: string | null
          sex: string | null
          phone: string | null
          whatsapp: string | null
          email: string | null
          mother_name: string | null
          address: Json | null
          notes: string | null
          active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["patients"]["Row"]> & {
          clinic_id: string
          full_name: string
        }
        Update: Partial<Database["public"]["Tables"]["patients"]["Row"]>
        Relationships: []
      }
      patient_clinical_info: {
        Row: {
          patient_id: string
          allergies: string[] | null
          chronic_conditions: string[] | null
          current_medications: string[] | null
          relevant_history: string | null
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["patient_clinical_info"]["Row"]> & {
          patient_id: string
        }
        Update: Partial<Database["public"]["Tables"]["patient_clinical_info"]["Row"]>
        Relationships: []
      }
      procedures: {
        Row: {
          id: string
          clinic_id: string
          name: string
          description: string | null
          duration_minutes: number
          price: number
          active: boolean
          created_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["procedures"]["Row"]> & {
          clinic_id: string
          name: string
        }
        Update: Partial<Database["public"]["Tables"]["procedures"]["Row"]>
        Relationships: []
      }
      payment_methods: {
        Row: {
          id: string
          clinic_id: string
          name: string
          slug: string
          active: boolean
        }
        Insert: Partial<Database["public"]["Tables"]["payment_methods"]["Row"]> & {
          clinic_id: string
          name: string
          slug: string
        }
        Update: Partial<Database["public"]["Tables"]["payment_methods"]["Row"]>
        Relationships: []
      }
      appointments: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          professional_id: string
          procedure_id: string | null
          scheduled_at: string
          duration_minutes: number
          status: AppointmentStatus
          notes: string | null
          cancelled_reason: string | null
          checked_in_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["appointments"]["Row"]> & {
          clinic_id: string
          patient_id: string
          professional_id: string
          scheduled_at: string
        }
        Update: Partial<Database["public"]["Tables"]["appointments"]["Row"]>
        Relationships: []
      }
      queue_entries: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          appointment_id: string | null
          professional_id: string | null
          specialty_id: string | null
          entry_type: QueueEntryType
          status: QueueStatus
          priority: number
          arrived_at: string
          called_at: string | null
          service_started_at: string | null
          finished_at: string | null
          financial_transaction_id: string | null
          released_at: string | null
          released_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["queue_entries"]["Row"]> & {
          clinic_id: string
          patient_id: string
        }
        Update: Partial<Database["public"]["Tables"]["queue_entries"]["Row"]>
        Relationships: []
      }
      queue_transfers: {
        Row: {
          id: string
          queue_entry_id: string
          from_professional_id: string | null
          to_professional_id: string
          reason: string | null
          transferred_by: string | null
          transferred_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["queue_transfers"]["Row"]> & {
          queue_entry_id: string
          to_professional_id: string
        }
        Update: Partial<Database["public"]["Tables"]["queue_transfers"]["Row"]>
        Relationships: []
      }
      service_sessions: {
        Row: {
          id: string
          clinic_id: string
          queue_entry_id: string
          professional_id: string
          patient_id: string
          started_at: string | null
          finished_at: string | null
          total_paused_seconds: number
          total_seconds: number | null
          effective_seconds: number | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["service_sessions"]["Row"]> & {
          clinic_id: string
          queue_entry_id: string
          professional_id: string
          patient_id: string
        }
        Update: Partial<Database["public"]["Tables"]["service_sessions"]["Row"]>
        Relationships: []
      }
      service_session_events: {
        Row: {
          id: string
          service_session_id: string
          event_type: ServiceEventType
          occurred_at: string
          created_by: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["service_session_events"]["Row"]> & {
          service_session_id: string
          event_type: ServiceEventType
        }
        Update: Partial<Database["public"]["Tables"]["service_session_events"]["Row"]>
        Relationships: []
      }
      cid_codes: {
        Row: { code: string; description: string; category: string | null }
        Insert: { code: string; description: string; category?: string | null }
        Update: Partial<Database["public"]["Tables"]["cid_codes"]["Row"]>
        Relationships: []
      }
      medical_records: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          professional_id: string
          appointment_id: string | null
          queue_entry_id: string | null
          service_session_id: string | null
          chief_complaint: string | null
          history: string | null
          exam: string | null
          assessment: string | null
          plan: string | null
          notes: string | null
          locked_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["medical_records"]["Row"]> & {
          clinic_id: string
          patient_id: string
          professional_id: string
        }
        Update: Partial<Database["public"]["Tables"]["medical_records"]["Row"]>
        Relationships: []
      }
      record_diagnoses: {
        Row: {
          id: string
          medical_record_id: string
          cid_code: string
          is_primary: boolean
        }
        Insert: Partial<Database["public"]["Tables"]["record_diagnoses"]["Row"]> & {
          medical_record_id: string
          cid_code: string
        }
        Update: Partial<Database["public"]["Tables"]["record_diagnoses"]["Row"]>
        Relationships: []
      }
      prescriptions: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          professional_id: string
          medical_record_id: string | null
          issued_at: string
          notes: string | null
          created_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["prescriptions"]["Row"]> & {
          clinic_id: string
          patient_id: string
          professional_id: string
        }
        Update: Partial<Database["public"]["Tables"]["prescriptions"]["Row"]>
        Relationships: []
      }
      prescription_items: {
        Row: {
          id: string
          prescription_id: string
          medication_name: string
          concentration: string | null
          pharmaceutical_form: string | null
          dose: string | null
          frequency: string | null
          duration: string | null
          quantity: string | null
          instructions: string | null
          order_index: number
        }
        Insert: Partial<Database["public"]["Tables"]["prescription_items"]["Row"]> & {
          prescription_id: string
          medication_name: string
        }
        Update: Partial<Database["public"]["Tables"]["prescription_items"]["Row"]>
        Relationships: []
      }
      document_templates: {
        Row: {
          id: string
          clinic_id: string
          type: ClinicalDocumentType
          name: string
          body_template: string
          active: boolean
          created_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["document_templates"]["Row"]> & {
          clinic_id: string
          type: ClinicalDocumentType
          name: string
          body_template: string
        }
        Update: Partial<Database["public"]["Tables"]["document_templates"]["Row"]>
        Relationships: []
      }
      clinical_documents: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          professional_id: string
          medical_record_id: string | null
          template_id: string | null
          type: ClinicalDocumentType
          content: string
          file_url: string | null
          issued_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["clinical_documents"]["Row"]> & {
          clinic_id: string
          patient_id: string
          professional_id: string
          type: ClinicalDocumentType
          content: string
        }
        Update: Partial<Database["public"]["Tables"]["clinical_documents"]["Row"]>
        Relationships: []
      }
      financial_transactions: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string | null
          appointment_id: string | null
          type: FinancialTransactionType
          category: string | null
          description: string | null
          amount: number
          due_date: string | null
          status: FinancialTransactionStatus
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["financial_transactions"]["Row"]> & {
          clinic_id: string
          type: FinancialTransactionType
          amount: number
        }
        Update: Partial<Database["public"]["Tables"]["financial_transactions"]["Row"]>
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          clinic_id: string
          financial_transaction_id: string
          payment_method_id: string
          amount: number
          paid_at: string
          received_by: string | null
          notes: string | null
        }
        Insert: Partial<Database["public"]["Tables"]["payments"]["Row"]> & {
          clinic_id: string
          financial_transaction_id: string
          payment_method_id: string
          amount: number
        }
        Update: Partial<Database["public"]["Tables"]["payments"]["Row"]>
        Relationships: []
      }
      message_templates: {
        Row: {
          id: string
          clinic_id: string
          type: MessageType
          channel: MessageChannel
          subject: string | null
          body_template: string
          active: boolean
        }
        Insert: Partial<Database["public"]["Tables"]["message_templates"]["Row"]> & {
          clinic_id: string
          type: MessageType
          channel: MessageChannel
          body_template: string
        }
        Update: Partial<Database["public"]["Tables"]["message_templates"]["Row"]>
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          template_id: string | null
          channel: MessageChannel
          type: MessageType
          status: MessageStatus
          payload: Json | null
          scheduled_at: string | null
          sent_at: string | null
          provider_response: Json | null
          created_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["messages"]["Row"]> & {
          clinic_id: string
          patient_id: string
          channel: MessageChannel
          type: MessageType
        }
        Update: Partial<Database["public"]["Tables"]["messages"]["Row"]>
        Relationships: []
      }
      files: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string | null
          professional_id: string | null
          related_type: string | null
          related_id: string | null
          bucket: string
          path: string
          file_name: string
          mime_type: string | null
          size_bytes: number | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["files"]["Row"]> & {
          clinic_id: string
          bucket: string
          path: string
          file_name: string
        }
        Update: Partial<Database["public"]["Tables"]["files"]["Row"]>
        Relationships: []
      }
      clinic_settings: {
        Row: { clinic_id: string; settings: Json; updated_at: string }
        Insert: Partial<Database["public"]["Tables"]["clinic_settings"]["Row"]> & {
          clinic_id: string
        }
        Update: Partial<Database["public"]["Tables"]["clinic_settings"]["Row"]>
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          clinic_id: string | null
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          before: Json | null
          after: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]> & {
          action: string
          entity_type: string
        }
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
