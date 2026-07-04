export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_number: string | null
          color: string | null
          created_at: string
          currency: string
          current_balance: number
          icon: string | null
          id: string
          is_archived: boolean
          kind: string
          name: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number?: string | null
          color?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          icon?: string | null
          id?: string
          is_archived?: boolean
          kind?: string
          name: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string | null
          color?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          icon?: string | null
          id?: string
          is_archived?: boolean
          kind?: string
          name?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      achievement_badges: {
        Row: {
          badge_code: string
          description: string | null
          earned_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          badge_code: string
          description?: string | null
          earned_at?: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          badge_code?: string
          description?: string | null
          earned_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          category: string | null
          created_at: string
          id: string
          message: string
          read_at: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          tenant_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          tenant_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          tenant_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      assist_deliverables: {
        Row: {
          admin_notes: string | null
          content_type: string | null
          created_at: string
          file_name: string
          id: string
          kind: string
          request_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          admin_notes?: string | null
          content_type?: string | null
          created_at?: string
          file_name: string
          id?: string
          kind?: string
          request_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          admin_notes?: string | null
          content_type?: string | null
          created_at?: string
          file_name?: string
          id?: string
          kind?: string
          request_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assist_deliverables_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "assist_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      assist_requests: {
        Row: {
          admin_notes: string | null
          assigned_to: string | null
          category_id: string
          category_name: string
          contact_email: string | null
          created_at: string
          expert_type: string | null
          id: string
          inputs: Json
          notes: string | null
          priority: string
          service_id: string
          service_name: string
          status: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          assigned_to?: string | null
          category_id: string
          category_name: string
          contact_email?: string | null
          created_at?: string
          expert_type?: string | null
          id?: string
          inputs?: Json
          notes?: string | null
          priority?: string
          service_id: string
          service_name: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          assigned_to?: string | null
          category_id?: string
          category_name?: string
          contact_email?: string | null
          created_at?: string
          expert_type?: string | null
          id?: string
          inputs?: Json
          notes?: string | null
          priority?: string
          service_id?: string
          service_name?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assist_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      assist_status_history: {
        Row: {
          admin_notes: string | null
          changed_by: string | null
          created_at: string
          event: string
          from_status: string | null
          id: string
          request_id: string
          to_status: string
        }
        Insert: {
          admin_notes?: string | null
          changed_by?: string | null
          created_at?: string
          event?: string
          from_status?: string | null
          id?: string
          request_id: string
          to_status: string
        }
        Update: {
          admin_notes?: string | null
          changed_by?: string | null
          created_at?: string
          event?: string
          from_status?: string | null
          id?: string
          request_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "assist_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "assist_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      budgets: {
        Row: {
          alert_threshold: number | null
          category: string
          created_at: string | null
          id: string
          monthly_limit: number
          tenant_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alert_threshold?: number | null
          category: string
          created_at?: string | null
          id?: string
          monthly_limit: number
          tenant_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alert_threshold?: number | null
          category?: string
          created_at?: string | null
          id?: string
          monthly_limit?: number
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          tenant_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          tenant_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          tenant_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      daily_notes: {
        Row: {
          created_at: string | null
          id: string
          note: string
          note_date: string
          tenant_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          note: string
          note_date: string
          tenant_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          note?: string
          note_date?: string
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      daily_summaries: {
        Row: {
          id: string
          net_balance: number | null
          summary_date: string
          tenant_id: string | null
          total_expense: number | null
          total_income: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          net_balance?: number | null
          summary_date: string
          tenant_id?: string | null
          total_expense?: number | null
          total_income?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          net_balance?: number | null
          summary_date?: string
          tenant_id?: string | null
          total_expense?: number | null
          total_income?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      financial_goals: {
        Row: {
          category: string | null
          color: string | null
          created_at: string
          current_amount: number
          icon: string | null
          id: string
          name: string
          notes: string | null
          status: string
          target_amount: number
          target_date: string | null
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string
          current_amount?: number
          icon?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: string
          target_amount: number
          target_date?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string
          current_amount?: number
          icon?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: string
          target_amount?: number
          target_date?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goal_contributions: {
        Row: {
          amount: number
          contributed_on: string
          created_at: string
          goal_id: string
          id: string
          note: string | null
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          contributed_on?: string
          created_at?: string
          goal_id: string
          id?: string
          note?: string | null
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          contributed_on?: string
          created_at?: string
          goal_id?: string
          id?: string
          note?: string | null
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "financial_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_contributions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_transactions: {
        Row: {
          action: Database["public"]["Enums"]["loan_action"]
          amount: number
          created_at: string
          id: string
          loan_id: string
          note: string | null
          occurred_at: string
          receipt_no: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["loan_action"]
          amount: number
          created_at?: string
          id?: string
          loan_id: string
          note?: string | null
          occurred_at?: string
          receipt_no?: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["loan_action"]
          amount?: number
          created_at?: string
          id?: string
          loan_id?: string
          note?: string | null
          occurred_at?: string
          receipt_no?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_transactions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          loan_date: string
          original_amount: number | null
          paid_date: string | null
          person_name: string
          status: Database["public"]["Enums"]["loan_status"]
          tenant_id: string | null
          type: Database["public"]["Enums"]["loan_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          loan_date?: string
          original_amount?: number | null
          paid_date?: string | null
          person_name: string
          status?: Database["public"]["Enums"]["loan_status"]
          tenant_id?: string | null
          type: Database["public"]["Enums"]["loan_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          loan_date?: string
          original_amount?: number | null
          paid_date?: string | null
          person_name?: string
          status?: Database["public"]["Enums"]["loan_status"]
          tenant_id?: string | null
          type?: Database["public"]["Enums"]["loan_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_dismissals: {
        Row: {
          dismissed_at: string
          id: string
          notification_id: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          id?: string
          notification_id: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          id?: string
          notification_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_dismissals_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          title?: string
        }
        Relationships: []
      }
      password_reset_requests: {
        Row: {
          approved_by: string | null
          attempt_count: number
          created_at: string
          email: string
          expires_at: string | null
          id: string
          phone: string
          reset_code: string | null
          reviewed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          attempt_count?: number
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          phone: string
          reset_code?: string | null
          reviewed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          approved_by?: string | null
          attempt_count?: number
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          phone?: string
          reset_code?: string | null
          reviewed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quota_requests: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          requested_by: string
          requested_max_users: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          requested_by: string
          requested_max_users: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          requested_by?: string
          requested_max_users?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quota_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_transactions: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          frequency: string
          id: string
          is_active: boolean | null
          next_run_date: string
          payment_method: string | null
          quantity: number | null
          tenant_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          unit_price: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          frequency: string
          id?: string
          is_active?: boolean | null
          next_run_date: string
          payment_method?: string | null
          quantity?: number | null
          tenant_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          unit_price: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          next_run_date?: string
          payment_method?: string | null
          quantity?: number | null
          tenant_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          unit_price?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      savings_accounts: {
        Row: {
          created_at: string
          current_balance: number
          goal_amount: number | null
          id: string
          name: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_balance?: number
          goal_amount?: number | null
          id?: string
          name?: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_balance?: number
          goal_amount?: number | null
          id?: string
          name?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      savings_transactions: {
        Row: {
          account_id: string
          action: Database["public"]["Enums"]["savings_action"]
          amount: number
          created_at: string
          id: string
          note: string | null
          occurred_at: string
          receipt_no: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          action: Database["public"]["Enums"]["savings_action"]
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          occurred_at?: string
          receipt_no?: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          action?: Database["public"]["Enums"]["savings_action"]
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          occurred_at?: string
          receipt_no?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "savings_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      spending_challenges: {
        Row: {
          category: string | null
          challenge_type: string
          created_at: string
          end_date: string
          id: string
          name: string
          progress: number | null
          start_date: string
          status: string
          target_amount: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          challenge_type?: string
          created_at?: string
          end_date: string
          id?: string
          name: string
          progress?: number | null
          start_date: string
          status?: string
          target_amount?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          challenge_type?: string
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          progress?: number | null
          start_date?: string
          status?: string
          target_amount?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tenant_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          max_uses: number
          note: string | null
          revoked: boolean
          tenant_id: string
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          max_uses?: number
          note?: string | null
          revoked?: boolean
          tenant_id: string
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          max_uses?: number
          note?: string | null
          revoked?: boolean
          tenant_id?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          business_name: string
          created_at: string
          id: string
          max_users: number
          owner_user_id: string
          tin_number: string | null
          updated_at: string
        }
        Insert: {
          business_name?: string
          created_at?: string
          id?: string
          max_users?: number
          owner_user_id: string
          tin_number?: string | null
          updated_at?: string
        }
        Update: {
          business_name?: string
          created_at?: string
          id?: string
          max_users?: number
          owner_user_id?: string
          tin_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transaction_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          kind: string | null
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          kind?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          transaction_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          kind?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_attachments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          category: string
          city: string | null
          country: string | null
          created_at: string | null
          currency: string
          description: string | null
          discount: number | null
          district: string | null
          exchange_rate: number | null
          final_amount: number | null
          id: string
          income_source: string | null
          life_event: string | null
          merchant_location: string | null
          merchant_name: string | null
          merchant_phone: string | null
          mood: string | null
          notes: string | null
          original_amount: number | null
          payment_method: string | null
          place_type: string | null
          purpose: string | null
          quantity: number | null
          status: string
          subcategory: string | null
          tags: string[] | null
          tax_amount: number | null
          tenant_id: string | null
          total_amount: number | null
          transaction_date: string
          transaction_fee: number | null
          transaction_time: string
          type: Database["public"]["Enums"]["transaction_type"]
          unit_price: number
          user_id: string
        }
        Insert: {
          account_id?: string | null
          category: string
          city?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          discount?: number | null
          district?: string | null
          exchange_rate?: number | null
          final_amount?: number | null
          id?: string
          income_source?: string | null
          life_event?: string | null
          merchant_location?: string | null
          merchant_name?: string | null
          merchant_phone?: string | null
          mood?: string | null
          notes?: string | null
          original_amount?: number | null
          payment_method?: string | null
          place_type?: string | null
          purpose?: string | null
          quantity?: number | null
          status?: string
          subcategory?: string | null
          tags?: string[] | null
          tax_amount?: number | null
          tenant_id?: string | null
          total_amount?: number | null
          transaction_date: string
          transaction_fee?: number | null
          transaction_time?: string
          type: Database["public"]["Enums"]["transaction_type"]
          unit_price: number
          user_id: string
        }
        Update: {
          account_id?: string | null
          category?: string
          city?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          discount?: number | null
          district?: string | null
          exchange_rate?: number | null
          final_amount?: number | null
          id?: string
          income_source?: string | null
          life_event?: string | null
          merchant_location?: string | null
          merchant_name?: string | null
          merchant_phone?: string | null
          mood?: string | null
          notes?: string | null
          original_amount?: number | null
          payment_method?: string | null
          place_type?: string | null
          purpose?: string | null
          quantity?: number | null
          status?: string
          subcategory?: string | null
          tags?: string[] | null
          tax_amount?: number | null
          tenant_id?: string | null
          total_amount?: number | null
          transaction_date?: string
          transaction_fee?: number | null
          transaction_time?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          unit_price?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_invite: {
        Args: { _expires_hours?: number; _max_uses?: number; _note?: string }
        Returns: {
          code: string
          id: string
        }[]
      }
      admin_filtered_transactions: {
        Args: {
          _category?: string
          _end_date?: string
          _start_date?: string
          _type?: string
        }
        Returns: {
          category: string
          total_amount: number
          transaction_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }[]
      }
      admin_global_stats: {
        Args: never
        Returns: {
          net_balance: number
          total_admins: number
          total_expense: number
          total_income: number
          total_loans_pending: number
          total_tenants: number
          total_transactions: number
          total_users: number
        }[]
      }
      admin_list_invites: {
        Args: never
        Returns: {
          code: string
          created_at: string
          expires_at: string
          id: string
          max_uses: number
          note: string
          revoked: boolean
          status: string
          uses: number
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          business_name: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_admin: boolean
          is_disabled: boolean
          last_sign_in_at: string
          phone: string
          tenant_id: string
          total_expense: number
          total_income: number
          tx_count: number
          username: string
        }[]
      }
      admin_promote_user: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _target: string
        }
        Returns: undefined
      }
      admin_review_quota_request: {
        Args: { _approve: boolean; _request_id: string }
        Returns: undefined
      }
      admin_revoke_invite: { Args: { _id: string }; Returns: undefined }
      admin_revoke_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _target: string
        }
        Returns: undefined
      }
      admin_set_user_disabled: {
        Args: { _disabled: boolean; _target_user: string }
        Returns: undefined
      }
      admin_tenants_overview: {
        Args: never
        Returns: {
          business_name: string
          created_at: string
          current_users: number
          max_users: number
          owner_email: string
          owner_full_name: string
          owner_phone: string
          tenant_id: string
          tin_number: string
          total_expense: number
          total_income: number
          total_loans: number
        }[]
      }
      admin_tenants_overview_paginated: {
        Args: { _limit?: number; _offset?: number; _search?: string }
        Returns: {
          business_name: string
          created_at: string
          current_users: number
          last_activity: string
          max_users: number
          owner_email: string
          owner_full_name: string
          owner_phone: string
          tenant_id: string
          tin_number: string
          total_count: number
          total_expense: number
          total_income: number
          total_loans_pending: number
          total_savings: number
        }[]
      }
      assist_expert_for_category: { Args: { _cat: string }; Returns: string }
      get_my_tenant: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _uid: string }; Returns: boolean }
      mark_reset_used: { Args: { _user_id: string }; Returns: undefined }
      my_tenant_info: {
        Args: never
        Returns: {
          business_name: string
          current_users: number
          is_owner: boolean
          max_users: number
          pending_request: boolean
          tenant_id: string
          tin_number: string
        }[]
      }
      peek_invite: {
        Args: { _code: string }
        Returns: {
          business_name: string
          reason: string
          valid: boolean
        }[]
      }
      redeem_invite_for: {
        Args: { _code: string; _user_id: string }
        Returns: string
      }
      request_password_reset: {
        Args: { _email: string; _phone: string }
        Returns: string
      }
      super_admin_approve_reset: {
        Args: { _request_id: string }
        Returns: string
      }
      super_admin_cron_history: {
        Args: { _jobid: number; _limit?: number }
        Returns: {
          end_time: string
          return_message: string
          runid: number
          start_time: string
          status: string
        }[]
      }
      super_admin_cron_status: {
        Args: never
        Returns: {
          active: boolean
          failed_runs: number
          jobid: number
          jobname: string
          last_return_message: string
          last_run_finished: string
          last_run_started: string
          last_status: string
          schedule: string
          total_runs: number
        }[]
      }
      super_admin_list_reset_requests: {
        Args: never
        Returns: {
          attempt_count: number
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          phone: string
          reset_code: string
          reviewed_at: string
          status: string
          user_id: string
        }[]
      }
      super_admin_log_action: {
        Args: {
          _action: string
          _metadata?: Json
          _target_id?: string
          _target_type?: string
        }
        Returns: string
      }
      super_admin_platform_pulse: { Args: never; Returns: Json }
      super_admin_reject_reset: {
        Args: { _request_id: string }
        Returns: undefined
      }
      tenant_drilldown: { Args: { _tenant_id: string }; Returns: Json }
      tenant_has_seat: { Args: { _tid: string }; Returns: boolean }
      update_business_profile: {
        Args: { _business_name: string; _tin_number: string }
        Returns: undefined
      }
      verify_reset_code: {
        Args: { _code: string; _email: string }
        Returns: string
      }
    }
    Enums: {
      alert_severity: "info" | "warning" | "critical"
      app_role: "admin" | "user" | "super_admin"
      loan_action: "ADD" | "FULL_REPAY" | "PARTIAL"
      loan_status: "PENDING" | "PAID"
      loan_type: "GIVEN" | "RECEIVED"
      notification_kind: "banner" | "popup"
      savings_action: "DEPOSIT" | "WITHDRAW"
      transaction_type: "INCOME" | "EXPENSE"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      alert_severity: ["info", "warning", "critical"],
      app_role: ["admin", "user", "super_admin"],
      loan_action: ["ADD", "FULL_REPAY", "PARTIAL"],
      loan_status: ["PENDING", "PAID"],
      loan_type: ["GIVEN", "RECEIVED"],
      notification_kind: ["banner", "popup"],
      savings_action: ["DEPOSIT", "WITHDRAW"],
      transaction_type: ["INCOME", "EXPENSE"],
    },
  },
} as const
