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
      audio_announcements: {
        Row: {
          audio_file_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          is_active: boolean
          is_tts: boolean
          played_at: string | null
          schedule_date: string | null
          title: string
          tts_text: string | null
          updated_at: string
          voice_id: string | null
        }
        Insert: {
          audio_file_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          is_tts?: boolean
          played_at?: string | null
          schedule_date?: string | null
          title: string
          tts_text?: string | null
          updated_at?: string
          voice_id?: string | null
        }
        Update: {
          audio_file_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          is_tts?: boolean
          played_at?: string | null
          schedule_date?: string | null
          title?: string
          tts_text?: string | null
          updated_at?: string
          voice_id?: string | null
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
      Klassen: {
        Row: {
          name: string
        }
        Insert: {
          name: string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      level_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          level: number
          permission_id: string
          updated_at: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          level: number
          permission_id: string
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          level?: number
          permission_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "level_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permission_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempted_at: string | null
          id: string
          ip_address: unknown | null
          success: boolean | null
          user_agent: string | null
          username: string
        }
        Insert: {
          attempted_at?: string | null
          id?: string
          ip_address?: unknown | null
          success?: boolean | null
          user_agent?: string | null
          username: string
        }
        Update: {
          attempted_at?: string | null
          id?: string
          ip_address?: unknown | null
          success?: boolean | null
          user_agent?: string | null
          username?: string
        }
        Relationships: []
      }
      permission_definitions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          requires_level: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id: string
          name: string
          requires_level?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          requires_level?: number
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
          user_class: string | null
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
          user_class?: string | null
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
          user_class?: string | null
          username?: string
        }
        Relationships: []
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
      teachers: {
        Row: {
          fav_rooms: string | null
          "first name": string
          "last name": string
          shortened: string
          subjects: string
        }
        Insert: {
          fav_rooms?: string | null
          "first name"?: string
          "last name"?: string
          shortened: string
          subjects: string
        }
        Update: {
          fav_rooms?: string | null
          "first name"?: string
          "last name"?: string
          shortened?: string
          subjects?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          permission_id: string
          updated_at: string
          user_id: number
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          permission_id: string
          updated_at?: string
          user_id: number
        }
        Update: {
          allowed?: boolean
          created_at?: string
          permission_id?: string
          updated_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permission_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string | null
          device_info: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          last_route: string | null
          session_token: string | null
          updated_at: string | null
          user_id: number | null
        }
        Insert: {
          created_at?: string | null
          device_info?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          last_route?: string | null
          session_token?: string | null
          updated_at?: string | null
          user_id?: number | null
        }
        Update: {
          created_at?: string | null
          device_info?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          last_route?: string | null
          session_token?: string | null
          updated_at?: string | null
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_themes: {
        Row: {
          colors: Json
          created_at: string
          id: string
          is_active: boolean
          is_preset: boolean
          name: string
          updated_at: string
          user_id: number
        }
        Insert: {
          colors?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          is_preset?: boolean
          name?: string
          updated_at?: string
          user_id: number
        }
        Update: {
          colors?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          is_preset?: boolean
          name?: string
          updated_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_themes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
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
      admin_change_user_password: {
        Args: {
          admin_user_id: number
          new_password: string
          target_user_id: number
        }
        Returns: Json
      }
      auto_assign_primary_session: {
        Args: { target_user_id: number }
        Returns: string
      }
      change_user_password: {
        Args: {
          new_password: string
          old_password: string
          user_id_input: number
        }
        Returns: Json
      }
      change_user_password_secure: {
        Args: {
          new_password: string
          old_password: string
          user_id_input: number
        }
        Returns: Json
      }
      check_brute_force_protection: {
        Args: { ip_address_input?: unknown; username_input: string }
        Returns: boolean
      }
      check_user_permission: {
        Args: { permission_id_param: string; user_id_param: number }
        Returns: boolean
      }
      cleanup_old_conversations: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_school_user: {
        Args: {
          creator_user_id: number
          full_name_input: string
          password_input: string
          permission_level_input: number
          username_input: string
        }
        Returns: Json
      }
      create_school_user_secure: {
        Args: {
          creator_user_id: number
          full_name_input: string
          password_input: string
          permission_level_input: number
          username_input: string
        }
        Returns: Json
      }
      get_current_user_id: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_current_user_permission_level: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      has_active_sessions: {
        Args: { target_user_id: number }
        Returns: boolean
      }
      hash_password: {
        Args: { password_input: string }
        Returns: string
      }
      invalidate_user_sessions: {
        Args: { keep_session_id?: string; target_user_id: number }
        Returns: undefined
      }
      is_current_user_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_current_user_admin_safe: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_session_valid: {
        Args: { session_id_param: string }
        Returns: boolean
      }
      log_login_attempt: {
        Args: {
          ip_address_input?: unknown
          success_input: boolean
          user_agent_input?: string
          username_input: string
        }
        Returns: undefined
      }
      release_primary_session: {
        Args: { target_user_id: number }
        Returns: undefined
      }
      rotate_session_token: {
        Args: { old_session_token: string }
        Returns: string
      }
      session_has_admin_rights: {
        Args: { session_id_param: string }
        Returns: boolean
      }
      set_primary_session: {
        Args: { session_id_param: string; target_user_id: number }
        Returns: undefined
      }
      verify_password: {
        Args: { password_hash: string; password_input: string }
        Returns: boolean
      }
      verify_user_login: {
        Args: { password_input: string; username_input: string }
        Returns: {
          full_name: string
          must_change_password: boolean
          permission_level: number
          profile_id: number
          user_id: number
        }[]
      }
      verify_user_login_secure: {
        Args:
          | {
              ip_address_input?: unknown
              password_input: string
              user_agent_input?: string
              username_input: string
            }
          | { password_input: string; username_input: string }
        Returns: {
          full_name: string
          must_change_password: boolean
          permission_level: number
          profile_id: number
          user_id: number
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
