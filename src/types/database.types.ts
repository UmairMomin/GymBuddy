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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      body_metrics: {
        Row: {
          body_fat_percentage: number | null
          created_at: string
          id: string
          notes: string | null
          recorded_date: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          body_fat_percentage?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          recorded_date?: string
          user_id: string
          weight_kg: number
        }
        Update: {
          body_fat_percentage?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          recorded_date?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "body_metrics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_links: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_links_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_links_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          category: string
          created_at: string
          handle_type: string | null
          id: string
          is_custom: boolean | null
          name: string
          notes: string | null
          owner_id: string | null
          primary_equipment: string | null
        }
        Insert: {
          category: string
          created_at?: string
          handle_type?: string | null
          id?: string
          is_custom?: boolean | null
          name: string
          notes?: string | null
          owner_id?: string | null
          primary_equipment?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          handle_type?: string | null
          id?: string
          is_custom?: boolean | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          primary_equipment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          preferred_unit: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          preferred_unit?: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          preferred_unit?: string
          updated_at?: string
          username?: string
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
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
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
      routine_versions: {
        Row: {
          created_at: string
          id: string
          routine_id: string
          structure_json: Json
          version_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          routine_id: string
          structure_json?: Json
          version_number: number
        }
        Update: {
          created_at?: string
          id?: string
          routine_id?: string
          structure_json?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "routine_versions_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
      routines: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routines_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_exercises: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          position: number
          rep_max: number | null
          rep_min: number | null
          rest_seconds: number | null
          session_id: string
          skipped: boolean
          target_sets: number
          user_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          position: number
          rep_max?: number | null
          rep_min?: number | null
          rest_seconds?: number | null
          session_id: string
          skipped?: boolean
          target_sets?: number
          user_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          position?: number
          rep_max?: number | null
          rep_min?: number | null
          rest_seconds?: number | null
          session_id?: string
          skipped?: boolean
          target_sets?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_participants: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string | null
          session_id: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          session_id: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          session_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_schedule: {
        Row: {
          routine_id: string | null
          user_id: string
          weekday: number
        }
        Insert: {
          routine_id?: string | null
          user_id: string
          weekday: number
        }
        Update: {
          routine_id?: string | null
          user_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_schedule_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_schedule_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          ended_at: string | null
          host_id: string
          id: string
          name: string
          notes: string | null
          routine_id: string | null
          routine_version_id: string | null
          started_at: string
          status: string
        }
        Insert: {
          ended_at?: string | null
          host_id: string
          id?: string
          name: string
          notes?: string | null
          routine_id?: string | null
          routine_version_id?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          ended_at?: string | null
          host_id?: string
          id?: string
          name?: string
          notes?: string | null
          routine_id?: string | null
          routine_version_id?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_routine_version_id_fkey"
            columns: ["routine_version_id"]
            isOneToOne: false
            referencedRelation: "routine_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sets: {
        Row: {
          completed: boolean
          created_at: string
          exercise_id: string
          id: string
          last_edited_by: string | null
          notes: string | null
          reps: number
          revision_number: number
          rpe: number | null
          session_id: string
          set_order: number
          set_type: string
          updated_at: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          completed?: boolean
          created_at?: string
          exercise_id: string
          id?: string
          last_edited_by?: string | null
          notes?: string | null
          reps?: number
          revision_number?: number
          rpe?: number | null
          session_id: string
          set_order: number
          set_type?: string
          updated_at?: string
          user_id: string
          weight_kg?: number
        }
        Update: {
          completed?: boolean
          created_at?: string
          exercise_id?: string
          id?: string
          last_edited_by?: string | null
          notes?: string | null
          reps?: number
          revision_number?: number
          rpe?: number | null
          session_id?: string
          set_order?: number
          set_type?: string
          updated_at?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sets_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sets_user_id_fkey"
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
      accept_buddy: { Args: { p_link_id: string }; Returns: undefined }
      archive_routine: { Args: { p_routine_id: string }; Returns: undefined }
      are_buddies: { Args: { _a: string; _b: string }; Returns: boolean }
      can_view_session: { Args: { _session: string }; Returns: boolean }
      decline_workout_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      find_profile_by_username: {
        Args: { p_username: string }
        Returns: {
          display_name: string
          id: string
          username: string
        }[]
      }
      finish_my_workout: { Args: { p_session_id: string }; Returns: undefined }
      finish_workout_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      has_accepted_buddy: { Args: { _user: string }; Returns: boolean }
      invite_buddy_to_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      invited_push_targets: {
        Args: { p_session_id: string }
        Returns: {
          auth: string
          endpoint: string
          p256dh: string
        }[]
      }
      is_linked_with: { Args: { _other: string }; Returns: boolean }
      is_session_member: { Args: { _session: string }; Returns: boolean }
      is_session_member_user: {
        Args: { _session: string; _user: string }
        Returns: boolean
      }
      join_workout_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      leave_workout_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      prune_push_subscription: {
        Args: { p_endpoint: string; p_session_id: string }
        Returns: undefined
      }
      request_buddy: { Args: { p_username: string }; Returns: string }
      save_push_subscription: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string }
        Returns: undefined
      }
      save_routine: {
        Args: {
          p_description: string
          p_name: string
          p_routine_id: string
          p_structure: Json
          p_weekdays: number[]
        }
        Returns: string
      }
      seed_starter_plan: { Args: never; Returns: undefined }
      start_workout_session: {
        Args: {
          p_name: string
          p_routine_id: string
          p_session_id: string
          p_with_buddy: boolean
        }
        Returns: string
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
    Enums: {},
  },
} as const
