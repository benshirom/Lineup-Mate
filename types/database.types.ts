// Auto-generated from Supabase. Regenerate with: npm run supabase:types
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
      artists: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      festivals: {
        Row: {
          clashfinder_slug: string | null
          color: string
          description: string | null
          description_he: string | null
          emoji: string
          end_date: string | null
          genre: string
          genre_label: string | null
          id: number
          last_synced_at: string | null
          location: string | null
          location_he: string | null
          name: string
          name_he: string | null
          raw_clashfinder: Json | null
          source_type: string | null
          source_url: string | null
          start_date: string | null
          website: string | null
          year: number
        }
        Insert: {
          clashfinder_slug?: string | null
          color?: string
          description?: string | null
          description_he?: string | null
          emoji?: string
          end_date?: string | null
          genre?: string
          genre_label?: string | null
          id?: number
          last_synced_at?: string | null
          location?: string | null
          location_he?: string | null
          name: string
          name_he?: string | null
          raw_clashfinder?: Json | null
          source_type?: string | null
          source_url?: string | null
          start_date?: string | null
          website?: string | null
          year: number
        }
        Update: {
          clashfinder_slug?: string | null
          color?: string
          description?: string | null
          description_he?: string | null
          emoji?: string
          end_date?: string | null
          genre?: string
          genre_label?: string | null
          id?: number
          last_synced_at?: string | null
          location?: string | null
          location_he?: string | null
          name?: string
          name_he?: string | null
          raw_clashfinder?: Json | null
          source_type?: string | null
          source_url?: string | null
          start_date?: string | null
          website?: string | null
          year?: number
        }
        Relationships: []
      }
      group_members: {
        Row: {
          created_at: string | null
          group_id: number | null
          id: number
          role: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          group_id?: number | null
          id?: number
          role?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          group_id?: number | null
          id?: number
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_users_email_confirmed"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string | null
          festival_id: number | null
          id: number
          invite_code: string
          is_blocked: boolean
          name: string
          owner_user_id: string | null
        }
        Insert: {
          created_at?: string | null
          festival_id?: number | null
          id?: number
          invite_code?: string
          is_blocked?: boolean
          name: string
          owner_user_id?: string | null
        }
        Update: {
          created_at?: string | null
          festival_id?: number | null
          id?: number
          invite_code?: string
          is_blocked?: boolean
          name?: string
          owner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "auth_users_email_confirmed"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          notify_before_minutes: number | null
          notify_group_changes: boolean | null
          notify_set_starting: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          notify_before_minutes?: number | null
          notify_group_changes?: boolean | null
          notify_set_starting?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          notify_before_minutes?: number | null
          notify_group_changes?: boolean | null
          notify_set_starting?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          group_id: number | null
          id: number
          is_read: boolean | null
          performance_id: number | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          group_id?: number | null
          id?: number
          is_read?: boolean | null
          performance_id?: number | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          group_id?: number | null
          id?: number
          is_read?: boolean | null
          performance_id?: number | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_performance_id_fkey"
            columns: ["performance_id"]
            isOneToOne: false
            referencedRelation: "performances"
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
      performances: {
        Row: {
          artist_id: number | null
          day_date: string
          end_time: string
          festival_id: number | null
          id: number
          is_active: boolean
          source_external_id: string | null
          source_last_seen_at: string | null
          stage_id: number | null
          start_time: string
        }
        Insert: {
          artist_id?: number | null
          day_date: string
          end_time: string
          festival_id?: number | null
          id?: number
          is_active?: boolean
          source_external_id?: string | null
          source_last_seen_at?: string | null
          stage_id?: number | null
          start_time: string
        }
        Update: {
          artist_id?: number | null
          day_date?: string
          end_time?: string
          festival_id?: number | null
          id?: number
          is_active?: boolean
          source_external_id?: string | null
          source_last_seen_at?: string | null
          stage_id?: number | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "performances_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performances_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performances_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_requests: {
        Row: {
          created_at: string | null
          id: number
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: number
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "auth_users_email_confirmed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_users_email_confirmed"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          is_blocked: boolean
          role: string
          theme: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          is_blocked?: boolean
          role?: string
          theme?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          is_blocked?: boolean
          role?: string
          theme?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "auth_users_email_confirmed"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          device_name: string | null
          endpoint: string
          id: string
          p256dh: string
          platform: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth?: string
          created_at?: string | null
          device_name?: string | null
          endpoint: string
          id?: string
          p256dh?: string
          platform?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          device_name?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          platform?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_festivals: {
        Row: {
          created_at: string | null
          festival_id: number
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          festival_id: number
          id?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          festival_id?: number
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_festivals_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_festivals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_users_email_confirmed"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          color: string
          festival_id: number | null
          id: number
          name: string
        }
        Insert: {
          color?: string
          festival_id?: number | null
          id?: number
          name: string
        }
        Update: {
          color?: string
          festival_id?: number | null
          id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "stages_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_performance_preferences: {
        Row: {
          id: number
          performance_id: number | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: number
          performance_id?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: number
          performance_id?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_performance_preferences_performance_id_fkey"
            columns: ["performance_id"]
            isOneToOne: false
            referencedRelation: "performances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_performance_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_users_email_confirmed"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      auth_users_email_confirmed: {
        Row: {
          email_confirmed_at: string | null
          id: string | null
        }
        Insert: {
          email_confirmed_at?: string | null
          id?: string | null
        }
        Update: {
          email_confirmed_at?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_group_preview: {
        Args: { p_code: string }
        Returns: {
          festival_name: string
          group_name: string
          member_count: number
        }[]
      }
      get_top_active_users: {
        Args: { n?: number }
        Returns: {
          preference_count: number
          user_id: string
        }[]
      }
      get_top_groups_by_members: {
        Args: { n?: number }
        Returns: {
          group_id: number
          member_count: number
        }[]
      }
      get_top_saved_festivals: {
        Args: { n?: number }
        Returns: {
          festival_id: number
          save_count: number
        }[]
      }
      join_group_by_invite_code: {
        Args: { p_invite_code: string }
        Returns: number
      }
      mark_all_notifications_read: { Args: never; Returns: undefined }
      my_group_ids: { Args: never; Returns: number[] }
      my_owned_group_ids: { Args: never; Returns: number[] }
      save_festival_for_user: {
        Args: { p_festival_id: number; p_user_id: string }
        Returns: undefined
      }
      shares_group_with: { Args: { target_user_id: string }; Returns: boolean }
      upsert_user_preference: {
        Args: { p_performance_id: number; p_status: string; p_user_id: string }
        Returns: undefined
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
