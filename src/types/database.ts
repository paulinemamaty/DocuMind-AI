export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: 'free' | 'pro' | 'enterprise'
          status: 'active' | 'canceled' | 'past_due' | 'trialing'
          current_period_start: string | null
          current_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: 'free' | 'pro' | 'enterprise'
          status?: 'active' | 'canceled' | 'past_due' | 'trialing'
          current_period_start?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: 'free' | 'pro' | 'enterprise'
          status?: 'active' | 'canceled' | 'past_due' | 'trialing'
          current_period_start?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          user_id: string
          filename: string
          file_url: string
          file_size: number
          mime_type: string
          status: 'pending' | 'processing' | 'completed' | 'failed'
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          filename: string
          file_url: string
          file_size: number
          mime_type: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          filename?: string
          file_url?: string
          file_size?: number
          mime_type?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      document_extractions: {
        Row: {
          id: string
          document_id: string
          full_text: string | null
          entities: Json | null
          tables: Json | null
          processing_time_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          full_text?: string | null
          entities?: Json | null
          tables?: Json | null
          processing_time_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          full_text?: string | null
          entities?: Json | null
          tables?: Json | null
          processing_time_ms?: number | null
          created_at?: string
        }
      }
      document_form_fields: {
        Row: {
          id: string
          document_id: string
          field_type: 'text' | 'checkbox' | 'radio' | 'date' | 'dropdown' | 'signature' | 'email' | 'tel'
          field_name: string | null
          field_label: string | null
          field_value: string | null
          confidence: number | null
          coordinates: Json
          page_number: number
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          document_id: string
          field_type?: 'text' | 'checkbox' | 'radio' | 'date' | 'dropdown' | 'signature' | 'email' | 'tel'
          field_name?: string | null
          field_label?: string | null
          field_value?: string | null
          confidence?: number | null
          coordinates: Json
          page_number: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          field_type?: 'text' | 'checkbox' | 'radio' | 'date' | 'dropdown' | 'signature' | 'email' | 'tel'
          field_name?: string | null
          field_label?: string | null
          field_value?: string | null
          confidence?: number | null
          coordinates?: Json
          page_number?: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      document_versions: {
        Row: {
          id: string
          document_id: string
          version_number: number
          changes: Json | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          version_number: number
          changes?: Json | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          version_number?: number
          changes?: Json | null
          created_by?: string
          created_at?: string
        }
      }
      document_edits: {
        Row: {
          id: string
          version_id: string
          edit_type: 'text' | 'signature' | 'checkbox' | 'form_fill'
          coordinates: Json
          value: string | null
          created_at: string
        }
        Insert: {
          id?: string
          version_id: string
          edit_type: 'text' | 'signature' | 'checkbox' | 'form_fill'
          coordinates: Json
          value?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          version_id?: string
          edit_type?: 'text' | 'signature' | 'checkbox' | 'form_fill'
          coordinates?: Json
          value?: string | null
          created_at?: string
        }
      }
      chat_sessions: {
        Row: {
          id: string
          document_id: string
          user_id: string
          messages: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          document_id: string
          user_id: string
          messages?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          user_id?: string
          messages?: Json
          created_at?: string
          updated_at?: string
        }
      }
      document_chunks: {
        Row: {
          id: string
          document_id: string
          chunk_index: number
          chunk_text: string
          embedding: string | null
          page_number: number | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          chunk_index: number
          chunk_text: string
          embedding?: string | null
          page_number?: number | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          chunk_index?: number
          chunk_text?: string
          embedding?: string | null
          page_number?: number | null
          metadata?: Json | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}