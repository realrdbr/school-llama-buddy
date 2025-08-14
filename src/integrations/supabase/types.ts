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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          author: string
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          priority: string | null
          target_class: string | null
          target_permission_level: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author: string
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          priority?: string | null
          target_class?: string | null
          target_permission_level?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          priority?: string | null
          target_class?: string | null
          target_permission_level?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_analysis: {
        Row: {
          analysis_result: Json | null
          content_summary: string | null
          created_at: string
          file_name: string
          file_path: string
          file_type: string
          grade_level: string | null
          id: string
          subject: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          analysis_result?: Json | null
          content_summary?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_type: string
          grade_level?: string | null
          id?: string
          subject?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          analysis_result?: Json | null
          content_summary?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_type?: string
          grade_level?: string | null
          id?: string
          subject?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          created_at: string
          id: number
          keycard_active: boolean | null
          keycard_number: string | null
          must_change_password: boolean | null
          name: string
          password: string
          permission_lvl: number | null
          username: string
        }
        Insert: {
          created_at?: string
          id?: number
          keycard_active?: boolean | null
          keycard_number?: string | null
          must_change_password?: boolean | null
          name: string
          password?: string
          permission_lvl?: number | null
          username?: string
        }
        Update: {
          created_at?: string
          id?: number
          keycard_active?: boolean | null
          keycard_number?: string | null
          must_change_password?: boolean | null
          name?: string
          password?: string
          permission_lvl?: number | null
          username?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string | null
          id: string
          must_change_password: boolean | null
          password_hash: string | null
          permission_id: number | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          must_change_password?: boolean | null
          password_hash?: string | null
          permission_id?: number | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          must_change_password?: boolean | null
          password_hash?: string | null
          permission_id?: number | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      Stundenplan_10b_A: {
        Row: {
          friday: string | null
          monday: string | null
          Stunde: number
          thursday: string | null
          tuesday: string | null
          wednesday: string | null
        }
        Insert: {
          friday?: string | null
          monday?: string | null
          Stunde?: number
          thursday?: string | null
          tuesday?: string | null
          wednesday?: string | null
        }
        Update: {
          friday?: string | null
          monday?: string | null
          Stunde?: number
          thursday?: string | null
          tuesday?: string | null
          wednesday?: string | null
        }
        Relationships: []
      }
      Stundenplan_10c_A: {
        Row: {
          friday: string | null
          monday: string | null
          Stunde: number
          thursday: string | null
          tuesday: string | null
          wednesday: string | null
        }
        Insert: {
          friday?: string | null
          monday?: string | null
          Stunde?: number
          thursday?: string | null
          tuesday?: string | null
          wednesday?: string | null
        }
        Update: {
          friday?: string | null
          monday?: string | null
          Stunde?: number
          thursday?: string | null
          tuesday?: string | null
          wednesday?: string | null
        }
        Relationships: []
      }
      vertretungsplan: {
        Row: {
          class_name: string
          created_at: string | null
          created_by: string | null
          date: string
          id: string
          note: string | null
          original_room: string
          original_subject: string
          original_teacher: string
          period: number
          substitute_room: string | null
          substitute_subject: string | null
          substitute_teacher: string | null
          updated_at: string | null
        }
        Insert: {
          class_name: string
          created_at?: string | null
          created_by?: string | null
          date: string
          id?: string
          note?: string | null
          original_room: string
          original_subject: string
          original_teacher: string
          period: number
          substitute_room?: string | null
          substitute_subject?: string | null
          substitute_teacher?: string | null
          updated_at?: string | null
        }
        Update: {
          class_name?: string
          created_at?: string | null
          created_by?: string | null
          date?: string
          id?: string
          note?: string | null
          original_room?: string
          original_subject?: string
          original_teacher?: string
          period?: number
          substitute_room?: string | null
          substitute_subject?: string | null
          substitute_teacher?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      change_user_password: {
        Args: {
          new_password: string
          old_password: string
          user_id_input: string
        }
        Returns: Json
      }
      cleanup_old_conversations: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_school_user: {
        Args: {
          creator_user_id: string
          full_name_input: string
          password_input: string
          permission_level_input: number
          username_input: string
        }
        Returns: Json
      }
      verify_user_login: {
        Args: { password_input: string; username_input: string }
        Returns: {
          full_name: string
          must_change_password: boolean
          permission_level: number
          profile_id: string
          user_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
