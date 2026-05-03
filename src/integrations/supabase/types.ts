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
      budgets: {
        Row: {
          alert_threshold: number | null
          category: string
          created_at: string | null
          id: string
          monthly_limit: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alert_threshold?: number | null
          category: string
          created_at?: string | null
          id?: string
          monthly_limit: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alert_threshold?: number | null
          category?: string
          created_at?: string | null
          id?: string
          monthly_limit?: number
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
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
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
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          note: string
          note_date: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          note?: string
          note_date?: string
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
          total_expense: number | null
          total_income: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          net_balance?: number | null
          summary_date: string
          total_expense?: number | null
          total_income?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          net_balance?: number | null
          summary_date?: string
          total_expense?: number | null
          total_income?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      loans: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          loan_date: string
          paid_date: string | null
          person_name: string
          status: Database["public"]["Enums"]["loan_status"]
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
          paid_date?: string | null
          person_name: string
          status?: Database["public"]["Enums"]["loan_status"]
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
          paid_date?: string | null
          person_name?: string
          status?: Database["public"]["Enums"]["loan_status"]
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
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
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          type?: Database["public"]["Enums"]["transaction_type"]
          unit_price?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          payment_method: string | null
          quantity: number | null
          total_amount: number | null
          transaction_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          unit_price: number
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          payment_method?: string | null
          quantity?: number | null
          total_amount?: number | null
          transaction_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          unit_price: number
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          payment_method?: string | null
          quantity?: number | null
          total_amount?: number | null
          transaction_date?: string
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
          total_expense: number
          total_income: number
          total_loans_pending: number
          total_transactions: number
          total_users: number
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_admin: boolean
          is_disabled: boolean
          last_sign_in_at: string
          phone: string
          total_expense: number
          total_income: number
          tx_count: number
          username: string
        }[]
      }
      admin_set_user_disabled: {
        Args: { _disabled: boolean; _target_user: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      loan_status: "PENDING" | "PAID"
      loan_type: "GIVEN" | "RECEIVED"
      notification_kind: "banner" | "popup"
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
      app_role: ["admin", "user"],
      loan_status: ["PENDING", "PAID"],
      loan_type: ["GIVEN", "RECEIVED"],
      notification_kind: ["banner", "popup"],
      transaction_type: ["INCOME", "EXPENSE"],
    },
  },
} as const
