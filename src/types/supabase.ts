// Generated from the live homologação Supabase project (Supabase MCP
// generate_typescript_types) and reconciled with the hand-written convenience aliases this
// codebase relies on (see below). Regenerate after any schema change, then diff against
// this file to re-add any alias a fresh run drops — database/*/schema.sql stays the source
// of truth for the schema itself.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]


// Convenience aliases mirroring Database["public"]["Enums"] — kept because dozens of
// files import these directly instead of drilling into the generated Enums map. This file
// is otherwise auto-generated (Supabase MCP generate_typescript_types against the live
// homologação project) — after regenerating, re-add any alias a fresh run drops.
export type AppointmentStatus = Database["public"]["Enums"]["appointment_status"]
export type ScheduleExceptionKind = Database["public"]["Enums"]["schedule_exception_kind"]
export type ConversationKind = Database["public"]["Enums"]["conversation_kind"]
export type NotificationKind = Database["public"]["Enums"]["notification_kind"]
export type QueueEntryType = Database["public"]["Enums"]["queue_entry_type"]
export type QueueStatus = Database["public"]["Enums"]["queue_status"]
export type ServiceEventType = Database["public"]["Enums"]["service_event_type"]
export type ClinicalDocumentType = Database["public"]["Enums"]["clinical_document_type"]
export type FinancialTransactionType = Database["public"]["Enums"]["financial_transaction_type"]
export type FinancialTransactionStatus = Database["public"]["Enums"]["financial_transaction_status"]
export type MessageChannel = Database["public"]["Enums"]["message_channel"]
export type MessageType = Database["public"]["Enums"]["message_type"]
export type MessageStatus = Database["public"]["Enums"]["message_status"]
export type PatientPackageStatus = Database["public"]["Enums"]["patient_package_status"]
export type PatientPackageSessionStatus = Database["public"]["Enums"]["patient_package_session_status"]

/**
 * Reason codes returned by the appointment_slot_problem SQL function
 * (database/migrations/002). Not a DB enum — the function returns plain text — so this
 * stays hand-written.
 */
export type SlotProblem =
  | "invalid_duration"
  | "crosses_midnight"
  | "outside_availability"
  | "blocked"
  | "professional_busy"
  | "room_busy"

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          cancelled_reason: string | null
          checked_in_at: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          duration_minutes: number
          id: string
          no_show_justified: boolean | null
          notes: string | null
          patient_id: string
          patient_package_session_id: string | null
          procedure_id: string | null
          professional_id: string
          room_id: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          time_range: unknown
          updated_at: string
        }
        Insert: {
          cancelled_reason?: string | null
          checked_in_at?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          no_show_justified?: boolean | null
          notes?: string | null
          patient_id: string
          patient_package_session_id?: string | null
          procedure_id?: string | null
          professional_id: string
          room_id?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          time_range?: unknown
          updated_at?: string
        }
        Update: {
          cancelled_reason?: string | null
          checked_in_at?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          no_show_justified?: boolean | null
          notes?: string | null
          patient_id?: string
          patient_package_session_id?: string | null
          procedure_id?: string | null
          professional_id?: string
          room_id?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          time_range?: unknown
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_package_session_id_fkey"
            columns: ["patient_package_session_id"]
            isOneToOne: false
            referencedRelation: "patient_package_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          clinic_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          clinic_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          clinic_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cid_codes: {
        Row: {
          category: string | null
          code: string
          description: string
        }
        Insert: {
          category?: string | null
          code: string
          description: string
        }
        Update: {
          category?: string | null
          code?: string
          description?: string
        }
        Relationships: []
      }
      clinic_memberships: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_memberships_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_memberships_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_settings: {
        Row: {
          clinic_id: string
          settings: Json
          updated_at: string
        }
        Insert: {
          clinic_id: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_documents: {
        Row: {
          clinic_id: string
          content: string
          file_url: string | null
          id: string
          issued_at: string
          medical_record_id: string | null
          patient_id: string
          professional_id: string
          template_id: string | null
          type: Database["public"]["Enums"]["clinical_document_type"]
        }
        Insert: {
          clinic_id: string
          content: string
          file_url?: string | null
          id?: string
          issued_at?: string
          medical_record_id?: string | null
          patient_id: string
          professional_id: string
          template_id?: string | null
          type: Database["public"]["Enums"]["clinical_document_type"]
        }
        Update: {
          clinic_id?: string
          content?: string
          file_url?: string | null
          id?: string
          issued_at?: string
          medical_record_id?: string | null
          patient_id?: string
          professional_id?: string
          template_id?: string | null
          type?: Database["public"]["Enums"]["clinical_document_type"]
        }
        Relationships: [
          {
            foreignKeyName: "clinical_documents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_documents_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_documents_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          active: boolean
          address: Json | null
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          legal_name: string | null
          logo_url: string | null
          mascot_url: string | null
          name: string
          phone: string | null
          primary_color: string
          secondary_color: string
          short_name: string | null
          slug: string
          staff_count: number | null
          timezone: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          address?: Json | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          mascot_url?: string | null
          name: string
          phone?: string | null
          primary_color?: string
          secondary_color?: string
          short_name?: string | null
          slug: string
          staff_count?: number | null
          timezone?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          address?: Json | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          mascot_url?: string | null
          name?: string
          phone?: string | null
          primary_color?: string
          secondary_color?: string
          short_name?: string | null
          slug?: string
          staff_count?: number | null
          timezone?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          last_read_at: string | null
          muted: boolean
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          muted?: boolean
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          muted?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          direct_key: string | null
          id: string
          kind: Database["public"]["Enums"]["conversation_kind"]
          last_message_at: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          direct_key?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["conversation_kind"]
          last_message_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          direct_key?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["conversation_kind"]
          last_message_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          active: boolean
          body_template: string
          clinic_id: string
          created_at: string
          id: string
          name: string
          type: Database["public"]["Enums"]["clinical_document_type"]
        }
        Insert: {
          active?: boolean
          body_template: string
          clinic_id: string
          created_at?: string
          id?: string
          name: string
          type: Database["public"]["Enums"]["clinical_document_type"]
        }
        Update: {
          active?: boolean
          body_template?: string
          clinic_id?: string
          created_at?: string
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["clinical_document_type"]
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          bucket: string
          clinic_id: string
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          path: string
          patient_id: string | null
          professional_id: string | null
          related_id: string | null
          related_type: string | null
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          bucket: string
          clinic_id: string
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          path: string
          patient_id?: string | null
          professional_id?: string | null
          related_id?: string | null
          related_type?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          bucket?: string
          clinic_id?: string
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          path?: string
          patient_id?: string | null
          professional_id?: string | null
          related_id?: string | null
          related_type?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          appointment_id: string | null
          category: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          patient_id: string | null
          status: Database["public"]["Enums"]["financial_transaction_status"]
          type: Database["public"]["Enums"]["financial_transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          category?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          patient_id?: string | null
          status?: Database["public"]["Enums"]["financial_transaction_status"]
          type: Database["public"]["Enums"]["financial_transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          category?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          patient_id?: string | null
          status?: Database["public"]["Enums"]["financial_transaction_status"]
          type?: Database["public"]["Enums"]["financial_transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_messages: {
        Row: {
          body: string
          clinic_id: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          clinic_id: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          clinic_id?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lp_contact: {
        Row: {
          address_neighborhood: string | null
          address_street: string | null
          city: string | null
          email: string | null
          facebook_url: string | null
          google_maps_embed_url: string | null
          google_maps_url: string | null
          hours_saturday: string | null
          hours_weekdays: string | null
          id: string
          instagram_url: string | null
          linkedin_url: string | null
          phone: string | null
          state: string | null
          updated_at: string | null
          whatsapp: string | null
          whatsapp_raw: string | null
          zip_code: string | null
        }
        Insert: {
          address_neighborhood?: string | null
          address_street?: string | null
          city?: string | null
          email?: string | null
          facebook_url?: string | null
          google_maps_embed_url?: string | null
          google_maps_url?: string | null
          hours_saturday?: string | null
          hours_weekdays?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          whatsapp?: string | null
          whatsapp_raw?: string | null
          zip_code?: string | null
        }
        Update: {
          address_neighborhood?: string | null
          address_street?: string | null
          city?: string | null
          email?: string | null
          facebook_url?: string | null
          google_maps_embed_url?: string | null
          google_maps_url?: string | null
          hours_saturday?: string | null
          hours_weekdays?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          whatsapp?: string | null
          whatsapp_raw?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      lp_faq: {
        Row: {
          answer: string
          created_at: string | null
          id: string
          is_active: boolean
          question: string
          sort_order: number
        }
        Insert: {
          answer: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          question: string
          sort_order?: number
        }
        Update: {
          answer?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          question?: string
          sort_order?: number
        }
        Relationships: []
      }
      lp_leads: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          message: string | null
          name: string
          phone: string
          service_interest: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          message?: string | null
          name: string
          phone: string
          service_interest?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          message?: string | null
          name?: string
          phone?: string
          service_interest?: string | null
          status?: string
        }
        Relationships: []
      }
      lp_sections: {
        Row: {
          id: string
          is_visible: boolean
          sort_order: number
          subtitle: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          id: string
          is_visible?: boolean
          sort_order?: number
          subtitle?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          is_visible?: boolean
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lp_services: {
        Row: {
          category: string | null
          created_at: string | null
          description: string
          duration: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          sort_order: number
          title: string
          whatsapp_message: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description: string
          duration?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          title: string
          whatsapp_message?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string
          duration?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          title?: string
          whatsapp_message?: string | null
        }
        Relationships: []
      }
      lp_settings: {
        Row: {
          about_image_url: string | null
          accent_color: string | null
          admin_pin: string | null
          background_color: string | null
          clinic_name: string
          font_family: string | null
          hero_badge: string | null
          hero_cta_text: string | null
          hero_cta_whatsapp: string | null
          hero_image_url: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          logo_url: string | null
          meta_description: string | null
          meta_title: string | null
          primary_color: string | null
          secondary_color: string | null
          tagline: string | null
          text_color: string | null
          updated_at: string | null
        }
        Insert: {
          about_image_url?: string | null
          accent_color?: string | null
          admin_pin?: string | null
          background_color?: string | null
          clinic_name?: string
          font_family?: string | null
          hero_badge?: string | null
          hero_cta_text?: string | null
          hero_cta_whatsapp?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          tagline?: string | null
          text_color?: string | null
          updated_at?: string | null
        }
        Update: {
          about_image_url?: string | null
          accent_color?: string | null
          admin_pin?: string | null
          background_color?: string | null
          clinic_name?: string
          font_family?: string | null
          hero_badge?: string | null
          hero_cta_text?: string | null
          hero_cta_whatsapp?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          tagline?: string | null
          text_color?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      lp_team: {
        Row: {
          bio: string | null
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          photo_url: string | null
          registry: string | null
          role: string
          sort_order: number
          specialties: string[] | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          photo_url?: string | null
          registry?: string | null
          role: string
          sort_order?: number
          specialties?: string[] | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          photo_url?: string | null
          registry?: string | null
          role?: string
          sort_order?: number
          specialties?: string[] | null
        }
        Relationships: []
      }
      lp_testimonials: {
        Row: {
          author_name: string
          author_role: string | null
          avatar_url: string | null
          comment: string
          created_at: string | null
          id: string
          is_active: boolean
          rating: number
          sort_order: number
        }
        Insert: {
          author_name: string
          author_role?: string | null
          avatar_url?: string | null
          comment: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          rating?: number
          sort_order?: number
        }
        Update: {
          author_name?: string
          author_role?: string | null
          avatar_url?: string | null
          comment?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          rating?: number
          sort_order?: number
        }
        Relationships: []
      }
      medical_records: {
        Row: {
          appointment_id: string | null
          assessment: string | null
          chief_complaint: string | null
          clinic_id: string
          created_at: string
          exam: string | null
          history: string | null
          id: string
          locked_at: string | null
          notes: string | null
          patient_id: string
          plan: string | null
          professional_id: string
          queue_entry_id: string | null
          service_session_id: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          assessment?: string | null
          chief_complaint?: string | null
          clinic_id: string
          created_at?: string
          exam?: string | null
          history?: string | null
          id?: string
          locked_at?: string | null
          notes?: string | null
          patient_id: string
          plan?: string | null
          professional_id: string
          queue_entry_id?: string | null
          service_session_id?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          assessment?: string | null
          chief_complaint?: string | null
          clinic_id?: string
          created_at?: string
          exam?: string | null
          history?: string | null
          id?: string
          locked_at?: string | null
          notes?: string | null
          patient_id?: string
          plan?: string | null
          professional_id?: string
          queue_entry_id?: string | null
          service_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "queue_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_service_session_id_fkey"
            columns: ["service_session_id"]
            isOneToOne: false
            referencedRelation: "service_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      message_automations: {
        Row: {
          channel: Database["public"]["Enums"]["message_channel"]
          clinic_id: string
          created_at: string
          enabled: boolean
          id: string
          offset_minutes: number
          send_at_time: string | null
          template_id: string | null
          type: Database["public"]["Enums"]["message_type"]
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["message_channel"]
          clinic_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          offset_minutes?: number
          send_at_time?: string | null
          template_id?: string | null
          type: Database["public"]["Enums"]["message_type"]
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["message_channel"]
          clinic_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          offset_minutes?: number
          send_at_time?: string | null
          template_id?: string | null
          type?: Database["public"]["Enums"]["message_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_automations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_automations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      message_campaigns: {
        Row: {
          audience: Database["public"]["Enums"]["campaign_audience"]
          body_template: string
          channel: Database["public"]["Enums"]["message_channel"]
          clinic_id: string
          created_at: string
          created_by: string | null
          failed_count: number
          finished_at: string | null
          id: string
          name: string
          patient_id: string | null
          recipients_count: number
          scheduled_for: string | null
          sent_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          subject: string | null
          updated_at: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["campaign_audience"]
          body_template: string
          channel?: Database["public"]["Enums"]["message_channel"]
          clinic_id: string
          created_at?: string
          created_by?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          name: string
          patient_id?: string | null
          recipients_count?: number
          scheduled_for?: string | null
          sent_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          subject?: string | null
          updated_at?: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["campaign_audience"]
          body_template?: string
          channel?: Database["public"]["Enums"]["message_channel"]
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          name?: string
          patient_id?: string | null
          recipients_count?: number
          scheduled_for?: string | null
          sent_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_campaigns_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_campaigns_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          active: boolean
          body_template: string
          channel: Database["public"]["Enums"]["message_channel"]
          clinic_id: string
          id: string
          subject: string | null
          type: Database["public"]["Enums"]["message_type"]
        }
        Insert: {
          active?: boolean
          body_template: string
          channel: Database["public"]["Enums"]["message_channel"]
          clinic_id: string
          id?: string
          subject?: string | null
          type: Database["public"]["Enums"]["message_type"]
        }
        Update: {
          active?: boolean
          body_template?: string
          channel?: Database["public"]["Enums"]["message_channel"]
          clinic_id?: string
          id?: string
          subject?: string | null
          type?: Database["public"]["Enums"]["message_type"]
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          campaign_id: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          clinic_id: string
          created_at: string
          id: string
          patient_id: string
          payload: Json | null
          provider_response: Json | null
          scheduled_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["message_status"]
          template_id: string | null
          type: Database["public"]["Enums"]["message_type"]
        }
        Insert: {
          campaign_id?: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          clinic_id: string
          created_at?: string
          id?: string
          patient_id: string
          payload?: Json | null
          provider_response?: Json | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          template_id?: string | null
          type: Database["public"]["Enums"]["message_type"]
        }
        Update: {
          campaign_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          clinic_id?: string
          created_at?: string
          id?: string
          patient_id?: string
          payload?: Json | null
          provider_response?: Json | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          template_id?: string | null
          type?: Database["public"]["Enums"]["message_type"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "message_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          clinic_id: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          href: string | null
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          clinic_id: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          href?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          clinic_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          href?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_clinical_info: {
        Row: {
          allergies: string[] | null
          chronic_conditions: string[] | null
          current_medications: string[] | null
          patient_id: string
          relevant_history: string | null
          updated_at: string
        }
        Insert: {
          allergies?: string[] | null
          chronic_conditions?: string[] | null
          current_medications?: string[] | null
          patient_id: string
          relevant_history?: string | null
          updated_at?: string
        }
        Update: {
          allergies?: string[] | null
          chronic_conditions?: string[] | null
          current_medications?: string[] | null
          patient_id?: string
          relevant_history?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_clinical_info_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_package_sessions: {
        Row: {
          appointment_id: string | null
          consumed_at: string | null
          id: string
          patient_package_id: string
          session_number: number
          status: Database["public"]["Enums"]["patient_package_session_status"]
        }
        Insert: {
          appointment_id?: string | null
          consumed_at?: string | null
          id?: string
          patient_package_id: string
          session_number: number
          status?: Database["public"]["Enums"]["patient_package_session_status"]
        }
        Update: {
          appointment_id?: string | null
          consumed_at?: string | null
          id?: string
          patient_package_id?: string
          session_number?: number
          status?: Database["public"]["Enums"]["patient_package_session_status"]
        }
        Relationships: [
          {
            foreignKeyName: "patient_package_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_package_sessions_patient_package_id_fkey"
            columns: ["patient_package_id"]
            isOneToOne: false
            referencedRelation: "patient_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_packages: {
        Row: {
          clinic_id: string
          financial_transaction_id: string | null
          id: string
          patient_id: string
          purchased_at: string
          session_package_id: string
          sessions_used: number
          status: Database["public"]["Enums"]["patient_package_status"]
          total_price: number
          total_sessions: number
        }
        Insert: {
          clinic_id: string
          financial_transaction_id?: string | null
          id?: string
          patient_id: string
          purchased_at?: string
          session_package_id: string
          sessions_used?: number
          status?: Database["public"]["Enums"]["patient_package_status"]
          total_price: number
          total_sessions: number
        }
        Update: {
          clinic_id?: string
          financial_transaction_id?: string | null
          id?: string
          patient_id?: string
          purchased_at?: string
          session_package_id?: string
          sessions_used?: number
          status?: Database["public"]["Enums"]["patient_package_status"]
          total_price?: number
          total_sessions?: number
        }
        Relationships: [
          {
            foreignKeyName: "patient_packages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_packages_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_packages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_packages_session_package_id_fkey"
            columns: ["session_package_id"]
            isOneToOne: false
            referencedRelation: "session_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          active: boolean
          address: Json | null
          birth_date: string | null
          clinic_id: string
          cpf: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          mother_name: string | null
          notes: string | null
          phone: string | null
          sex: string | null
          social_name: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          address?: Json | null
          birth_date?: string | null
          clinic_id: string
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          mother_name?: string | null
          notes?: string | null
          phone?: string | null
          sex?: string | null
          social_name?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          address?: Json | null
          birth_date?: string | null
          clinic_id?: string
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          mother_name?: string | null
          notes?: string | null
          phone?: string | null
          sex?: string | null
          social_name?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          active: boolean
          clinic_id: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          clinic_id: string
          external_id: string | null
          external_provider: string | null
          financial_transaction_id: string
          id: string
          notes: string | null
          paid_at: string
          payment_method_id: string
          received_by: string | null
        }
        Insert: {
          amount: number
          clinic_id: string
          external_id?: string | null
          external_provider?: string | null
          financial_transaction_id: string
          id?: string
          notes?: string | null
          paid_at?: string
          payment_method_id: string
          received_by?: string | null
        }
        Update: {
          amount?: number
          clinic_id?: string
          external_id?: string | null
          external_provider?: string | null
          financial_transaction_id?: string
          id?: string
          notes?: string | null
          paid_at?: string
          payment_method_id?: string
          received_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          description: string | null
          id: string
          module: string
          slug: string
        }
        Insert: {
          description?: string | null
          id?: string
          module: string
          slug: string
        }
        Update: {
          description?: string | null
          id?: string
          module?: string
          slug?: string
        }
        Relationships: []
      }
      prescription_items: {
        Row: {
          concentration: string | null
          dose: string | null
          duration: string | null
          frequency: string | null
          id: string
          instructions: string | null
          medication_name: string
          order_index: number
          pharmaceutical_form: string | null
          prescription_id: string
          quantity: string | null
        }
        Insert: {
          concentration?: string | null
          dose?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medication_name: string
          order_index?: number
          pharmaceutical_form?: string | null
          prescription_id: string
          quantity?: string | null
        }
        Update: {
          concentration?: string | null
          dose?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medication_name?: string
          order_index?: number
          pharmaceutical_form?: string | null
          prescription_id?: string
          quantity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          issued_at: string
          medical_record_id: string | null
          notes: string | null
          patient_id: string
          professional_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          issued_at?: string
          medical_record_id?: string | null
          notes?: string | null
          patient_id: string
          professional_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          issued_at?: string
          medical_record_id?: string | null
          notes?: string | null
          patient_id?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      procedures: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          name: string
          price: number
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name: string
          price?: number
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "procedures_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_availability: {
        Row: {
          active: boolean
          back_to_back: boolean
          clinic_id: string
          created_at: string
          end_time: string
          id: string
          professional_id: string
          room_id: string | null
          slot_minutes: number
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          active?: boolean
          back_to_back?: boolean
          clinic_id: string
          created_at?: string
          end_time: string
          id?: string
          professional_id: string
          room_id?: string | null
          slot_minutes?: number
          start_time: string
          updated_at?: string
          weekday: number
        }
        Update: {
          active?: boolean
          back_to_back?: boolean
          clinic_id?: string
          created_at?: string
          end_time?: string
          id?: string
          professional_id?: string
          room_id?: string | null
          slot_minutes?: number
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_availability_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_availability_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_availability_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          active: boolean
          clinic_id: string
          color: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          professional_register: string | null
          specialty_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          clinic_id: string
          color?: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          professional_register?: string | null
          specialty_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          clinic_id?: string
          color?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          professional_register?: string | null
          specialty_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      queue_entries: {
        Row: {
          appointment_id: string | null
          arrived_at: string
          call_acknowledged_at: string | null
          call_acknowledged_by: string | null
          called_at: string | null
          clinic_id: string
          created_at: string
          entry_type: Database["public"]["Enums"]["queue_entry_type"]
          financial_transaction_id: string | null
          finished_at: string | null
          id: string
          patient_id: string
          priority: number
          professional_id: string | null
          released_at: string | null
          released_by: string | null
          service_started_at: string | null
          specialty_id: string | null
          status: Database["public"]["Enums"]["queue_status"]
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          arrived_at?: string
          call_acknowledged_at?: string | null
          call_acknowledged_by?: string | null
          called_at?: string | null
          clinic_id: string
          created_at?: string
          entry_type?: Database["public"]["Enums"]["queue_entry_type"]
          financial_transaction_id?: string | null
          finished_at?: string | null
          id?: string
          patient_id: string
          priority?: number
          professional_id?: string | null
          released_at?: string | null
          released_by?: string | null
          service_started_at?: string | null
          specialty_id?: string | null
          status?: Database["public"]["Enums"]["queue_status"]
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          arrived_at?: string
          call_acknowledged_at?: string | null
          call_acknowledged_by?: string | null
          called_at?: string | null
          clinic_id?: string
          created_at?: string
          entry_type?: Database["public"]["Enums"]["queue_entry_type"]
          financial_transaction_id?: string | null
          finished_at?: string | null
          id?: string
          patient_id?: string
          priority?: number
          professional_id?: string | null
          released_at?: string | null
          released_by?: string | null
          service_started_at?: string | null
          specialty_id?: string | null
          status?: Database["public"]["Enums"]["queue_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_entries_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_call_acknowledged_by_fkey"
            columns: ["call_acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_transfers: {
        Row: {
          from_professional_id: string | null
          id: string
          queue_entry_id: string
          reason: string | null
          to_professional_id: string
          transferred_at: string
          transferred_by: string | null
        }
        Insert: {
          from_professional_id?: string | null
          id?: string
          queue_entry_id: string
          reason?: string | null
          to_professional_id: string
          transferred_at?: string
          transferred_by?: string | null
        }
        Update: {
          from_professional_id?: string | null
          id?: string
          queue_entry_id?: string
          reason?: string | null
          to_professional_id?: string
          transferred_at?: string
          transferred_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_transfers_from_professional_id_fkey"
            columns: ["from_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_transfers_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "queue_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_transfers_to_professional_id_fkey"
            columns: ["to_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_transfers_transferred_by_fkey"
            columns: ["transferred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      record_diagnoses: {
        Row: {
          cid_code: string
          id: string
          is_primary: boolean
          medical_record_id: string
        }
        Insert: {
          cid_code: string
          id?: string
          is_primary?: boolean
          medical_record_id: string
        }
        Update: {
          cid_code?: string
          id?: string
          is_primary?: boolean
          medical_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_diagnoses_cid_code_fkey"
            columns: ["cid_code"]
            isOneToOne: false
            referencedRelation: "cid_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "record_diagnoses_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          clinic_id: string | null
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          slug: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          slug: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          active: boolean
          capacity: number
          clinic_id: string
          created_at: string
          id: string
          kind: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          capacity?: number
          clinic_id: string
          created_at?: string
          id?: string
          kind?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          capacity?: number
          clinic_id?: string
          created_at?: string
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_exceptions: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          kind: Database["public"]["Enums"]["schedule_exception_kind"]
          professional_id: string | null
          reason: string | null
          starts_at: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          kind?: Database["public"]["Enums"]["schedule_exception_kind"]
          professional_id?: string | null
          reason?: string | null
          starts_at: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["schedule_exception_kind"]
          professional_id?: string | null
          reason?: string | null
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_exceptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      service_session_events: {
        Row: {
          created_by: string | null
          event_type: Database["public"]["Enums"]["service_event_type"]
          id: string
          occurred_at: string
          service_session_id: string
        }
        Insert: {
          created_by?: string | null
          event_type: Database["public"]["Enums"]["service_event_type"]
          id?: string
          occurred_at?: string
          service_session_id: string
        }
        Update: {
          created_by?: string | null
          event_type?: Database["public"]["Enums"]["service_event_type"]
          id?: string
          occurred_at?: string
          service_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_session_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_session_events_service_session_id_fkey"
            columns: ["service_session_id"]
            isOneToOne: false
            referencedRelation: "service_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      service_sessions: {
        Row: {
          clinic_id: string
          created_at: string
          effective_seconds: number | null
          finished_at: string | null
          id: string
          patient_id: string
          professional_id: string
          queue_entry_id: string
          started_at: string | null
          total_paused_seconds: number
          total_seconds: number | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          effective_seconds?: number | null
          finished_at?: string | null
          id?: string
          patient_id: string
          professional_id: string
          queue_entry_id: string
          started_at?: string | null
          total_paused_seconds?: number
          total_seconds?: number | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          effective_seconds?: number | null
          finished_at?: string | null
          id?: string
          patient_id?: string
          professional_id?: string
          queue_entry_id?: string
          started_at?: string | null
          total_paused_seconds?: number
          total_seconds?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_sessions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_sessions_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "queue_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      session_packages: {
        Row: {
          active: boolean
          billing_mode: string
          clinic_id: string
          created_at: string
          id: string
          name: string
          price_per_session: number | null
          specialty_id: string
          total_price: number
          total_sessions: number
        }
        Insert: {
          active?: boolean
          billing_mode?: string
          clinic_id: string
          created_at?: string
          id?: string
          name: string
          price_per_session?: number | null
          specialty_id: string
          total_price: number
          total_sessions: number
        }
        Update: {
          active?: boolean
          billing_mode?: string
          clinic_id?: string
          created_at?: string
          id?: string
          name?: string
          price_per_session?: number | null
          specialty_id?: string
          total_price?: number
          total_sessions?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_packages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_packages_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      specialties: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialties_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          clinic_id: string | null
          error: string | null
          id: string
          payload: Json
          processed_at: string | null
          received_at: string
          type: string
        }
        Insert: {
          clinic_id?: string | null
          error?: string | null
          id: string
          payload: Json
          processed_at?: string | null
          received_at?: string
          type: string
        }
        Update: {
          clinic_id?: string | null
          error?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          received_at?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_overrides: {
        Row: {
          clinic_id: string
          created_at: string
          granted: boolean
          id: string
          permission_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          granted: boolean
          id?: string
          permission_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          granted?: boolean
          id?: string
          permission_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_overrides_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      appointment_slot_problem: {
        Args: {
          p_clinic: string
          p_duration: number
          p_exclude?: string
          p_professional: string
          p_room: string
          p_start: string
        }
        Returns: string
      }
      campaign_recipients: {
        Args: { p_campaign: string }
        Returns: {
          email: string
          full_name: string
          patient_id: string
          phone: string
        }[]
      }
      clinic_occupancy: {
        Args: { p_clinic: string; p_from: string; p_to: string }
        Returns: {
          available_minutes: number
          booked_minutes: number
          professional_id: string
        }[]
      }
      has_clinic_access: {
        Args: { target_clinic_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { permission_slug: string; target_clinic_id: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { p_conversation: string }
        Returns: boolean
      }
      lp_is_admin: { Args: never; Returns: boolean }
      professional_free_slots: {
        Args: {
          p_clinic: string
          p_date: string
          p_duration?: number
          p_professional: string
        }
        Returns: {
          slot_end: string
          slot_start: string
        }[]
      }
      public_clinic_branding: {
        Args: { p_slug?: string }
        Returns: {
          logo_url: string
          mascot_url: string
          name: string
          primary_color: string
        }[]
      }
      user_effective_permissions: {
        Args: { p_clinic: string; p_user: string }
        Returns: {
          description: string
          effective: boolean
          from_role: boolean
          module: string
          override: string
          permission_id: string
          slug: string
        }[]
      }
    }
    Enums: {
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "cancelled"
        | "no_show"
        | "completed"
      campaign_audience: "active" | "inactive" | "all" | "single"
      campaign_status:
        | "draft"
        | "scheduled"
        | "sending"
        | "sent"
        | "cancelled"
        | "failed"
      clinical_document_type:
        | "atestado"
        | "declaracao"
        | "relatorio"
        | "encaminhamento"
        | "outros"
      conversation_kind: "direct" | "group"
      financial_transaction_status:
        | "pendente"
        | "pago"
        | "atrasado"
        | "cancelado"
      financial_transaction_type: "receita" | "despesa"
      message_channel: "whatsapp" | "sms" | "email"
      message_status: "queued" | "sent" | "failed" | "skipped"
      message_type:
        | "confirmation"
        | "reminder"
        | "birthday"
        | "post_visit"
        | "general"
      notification_kind: "system" | "chat" | "queue" | "agenda" | "financial"
      patient_package_session_status: "reserved" | "consumed" | "released"
      patient_package_status: "active" | "completed" | "cancelled"
      queue_entry_type: "scheduled" | "walk_in" | "fit_in" | "transfer"
      queue_status:
        | "payment_pending"
        | "released"
        | "waiting"
        | "called"
        | "in_service"
        | "paused"
        | "completed"
        | "cancelled"
      schedule_exception_kind: "block" | "extra"
      service_event_type: "start" | "pause" | "resume" | "finish"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_status: [
        "scheduled",
        "confirmed",
        "cancelled",
        "no_show",
        "completed",
      ],
      campaign_audience: ["active", "inactive", "all", "single"],
      campaign_status: [
        "draft",
        "scheduled",
        "sending",
        "sent",
        "cancelled",
        "failed",
      ],
      clinical_document_type: [
        "atestado",
        "declaracao",
        "relatorio",
        "encaminhamento",
        "outros",
      ],
      conversation_kind: ["direct", "group"],
      financial_transaction_status: [
        "pendente",
        "pago",
        "atrasado",
        "cancelado",
      ],
      financial_transaction_type: ["receita", "despesa"],
      message_channel: ["whatsapp", "sms", "email"],
      message_status: ["queued", "sent", "failed", "skipped"],
      message_type: [
        "confirmation",
        "reminder",
        "birthday",
        "post_visit",
        "general",
      ],
      notification_kind: ["system", "chat", "queue", "agenda", "financial"],
      patient_package_session_status: ["reserved", "consumed", "released"],
      patient_package_status: ["active", "completed", "cancelled"],
      queue_entry_type: ["scheduled", "walk_in", "fit_in", "transfer"],
      queue_status: [
        "payment_pending",
        "released",
        "waiting",
        "called",
        "in_service",
        "paused",
        "completed",
        "cancelled",
      ],
      schedule_exception_kind: ["block", "extra"],
      service_event_type: ["start", "pause", "resume", "finish"],
    },
  },
} as const
