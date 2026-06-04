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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      alpha_experiments: {
        Row: {
          approved_at: string | null
          confidence_score: number | null
          created_at: string
          created_by: string | null
          id: string
          metrics: Json | null
          notes: string | null
          previous_alpha: number | null
          proposed_alpha: number
          reason: string | null
          rejected_at: string | null
          reviewer_id: string | null
          route_id: string
          sample_size: number | null
          status: Database["public"]["Enums"]["experiment_status"]
        }
        Insert: {
          approved_at?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          metrics?: Json | null
          notes?: string | null
          previous_alpha?: number | null
          proposed_alpha: number
          reason?: string | null
          rejected_at?: string | null
          reviewer_id?: string | null
          route_id: string
          sample_size?: number | null
          status?: Database["public"]["Enums"]["experiment_status"]
        }
        Update: {
          approved_at?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          metrics?: Json | null
          notes?: string | null
          previous_alpha?: number | null
          proposed_alpha?: number
          reason?: string | null
          rejected_at?: string | null
          reviewer_id?: string | null
          route_id?: string
          sample_size?: number | null
          status?: Database["public"]["Enums"]["experiment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "alpha_experiments_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alpha_experiments_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes_public"
            referencedColumns: ["id"]
          },
        ]
      }
      casual_runs: {
        Row: {
          alpha_used: number
          created_at: string
          distance_m: number
          duration_s: number
          elevation_gain_m: number
          elevation_loss_m: number | null
          id: string
          included_in_calibration: boolean
          notes: string | null
          performance_score: number | null
          route_name: string
          rpe: number | null
          scoring_formula_version: number
          terrain_type: Database["public"]["Enums"]["surface_type"]
          updated_at: string
          user_id: string
          weather_notes: string | null
        }
        Insert: {
          alpha_used?: number
          created_at?: string
          distance_m: number
          duration_s: number
          elevation_gain_m?: number
          elevation_loss_m?: number | null
          id?: string
          included_in_calibration?: boolean
          notes?: string | null
          performance_score?: number | null
          route_name: string
          rpe?: number | null
          scoring_formula_version?: number
          terrain_type?: Database["public"]["Enums"]["surface_type"]
          updated_at?: string
          user_id: string
          weather_notes?: string | null
        }
        Update: {
          alpha_used?: number
          created_at?: string
          distance_m?: number
          duration_s?: number
          elevation_gain_m?: number
          elevation_loss_m?: number | null
          id?: string
          included_in_calibration?: boolean
          notes?: string | null
          performance_score?: number | null
          route_name?: string
          rpe?: number | null
          scoring_formula_version?: number
          terrain_type?: Database["public"]["Enums"]["surface_type"]
          updated_at?: string
          user_id?: string
          weather_notes?: string | null
        }
        Relationships: []
      }
      event_bonus_challenges: {
        Row: {
          correct_answer: string | null
          created_at: string
          event_id: string
          id: string
          lock_at: string | null
          option_a: string
          option_b: string
          penalty_m: number
          question: string
          updated_at: string
        }
        Insert: {
          correct_answer?: string | null
          created_at?: string
          event_id: string
          id?: string
          lock_at?: string | null
          option_a: string
          option_b: string
          penalty_m?: number
          question: string
          updated_at?: string
        }
        Update: {
          correct_answer?: string | null
          created_at?: string
          event_id?: string
          id?: string
          lock_at?: string | null
          option_a?: string
          option_b?: string
          penalty_m?: number
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_bonus_picks: {
        Row: {
          created_at: string
          event_id: string
          id: string
          pick: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          pick: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          pick?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_comments: {
        Row: {
          body: string
          created_at: string
          event_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          event_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_participants: {
        Row: {
          event_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_public"
            referencedColumns: ["id"]
          },
        ]
      }
      event_results: {
        Row: {
          admin_note: string | null
          alpha_used: number | null
          created_at: string
          distance_m: number | null
          duration_s: number | null
          elevation_gain_m: number | null
          elevation_loss_m: number | null
          event_id: string
          finish_time: string | null
          id: string
          notes: string | null
          performance_score: number | null
          proof_image_url: string | null
          route_id: string | null
          rpe: number | null
          rpe_notes: string | null
          scoring_formula_version: number
          session_load: number | null
          source: string
          start_time: string | null
          status: string
          submitted_duration_s: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          alpha_used?: number | null
          created_at?: string
          distance_m?: number | null
          duration_s?: number | null
          elevation_gain_m?: number | null
          elevation_loss_m?: number | null
          event_id: string
          finish_time?: string | null
          id?: string
          notes?: string | null
          performance_score?: number | null
          proof_image_url?: string | null
          route_id?: string | null
          rpe?: number | null
          rpe_notes?: string | null
          scoring_formula_version?: number
          session_load?: number | null
          source?: string
          start_time?: string | null
          status?: string
          submitted_duration_s?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          alpha_used?: number | null
          created_at?: string
          distance_m?: number | null
          duration_s?: number | null
          elevation_gain_m?: number | null
          elevation_loss_m?: number | null
          event_id?: string
          finish_time?: string | null
          id?: string
          notes?: string | null
          performance_score?: number | null
          proof_image_url?: string | null
          route_id?: string | null
          rpe?: number | null
          rpe_notes?: string | null
          scoring_formula_version?: number
          session_load?: number | null
          source?: string
          start_time?: string | null
          status?: string
          submitted_duration_s?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_results_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_results_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_results_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_results_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes_public"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          alpha: number
          created_at: string
          created_by: string | null
          event_date: string
          gpx_file_url: string | null
          id: string
          location: string | null
          meetup_time: string | null
          results_published: boolean
          route: string | null
          route_distance_m: number | null
          route_elevation_gain_m: number | null
          route_elevation_loss_m: number | null
          route_id: string | null
          title: string
        }
        Insert: {
          alpha?: number
          created_at?: string
          created_by?: string | null
          event_date: string
          gpx_file_url?: string | null
          id?: string
          location?: string | null
          meetup_time?: string | null
          results_published?: boolean
          route?: string | null
          route_distance_m?: number | null
          route_elevation_gain_m?: number | null
          route_elevation_loss_m?: number | null
          route_id?: string | null
          title: string
        }
        Update: {
          alpha?: number
          created_at?: string
          created_by?: string | null
          event_date?: string
          gpx_file_url?: string | null
          id?: string
          location?: string | null
          meetup_time?: string | null
          results_published?: boolean
          route?: string | null
          route_distance_m?: number | null
          route_elevation_gain_m?: number | null
          route_elevation_loss_m?: number | null
          route_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          show_on_leaderboard: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id?: string
          show_on_leaderboard?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          show_on_leaderboard?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      route_alpha_history: {
        Row: {
          changed_by: string | null
          created_at: string
          experiment_id: string | null
          id: string
          new_alpha: number
          previous_alpha: number | null
          reason: string | null
          route_id: string
          source: Database["public"]["Enums"]["alpha_history_source"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          experiment_id?: string | null
          id?: string
          new_alpha: number
          previous_alpha?: number | null
          reason?: string | null
          route_id: string
          source: Database["public"]["Enums"]["alpha_history_source"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          experiment_id?: string | null
          id?: string
          new_alpha?: number
          previous_alpha?: number | null
          reason?: string | null
          route_id?: string
          source?: Database["public"]["Enums"]["alpha_history_source"]
        }
        Relationships: [
          {
            foreignKeyName: "route_alpha_history_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_alpha_history_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes_public"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          alpha_last_updated_at: string | null
          alpha_notes: string | null
          alpha_status: Database["public"]["Enums"]["alpha_status"]
          calibration_confidence: number | null
          calibration_sample_size: number
          created_at: string
          created_by: string | null
          current_alpha: number
          description: string | null
          distance_m: number | null
          elevation_gain_m: number | null
          elevation_loss_m: number | null
          gpx_file_url: string | null
          id: string
          name: string
          suggested_alpha: number | null
          surface_type: Database["public"]["Enums"]["surface_type"]
          technicality_rating: number | null
          terrain_notes: string | null
          updated_at: string
        }
        Insert: {
          alpha_last_updated_at?: string | null
          alpha_notes?: string | null
          alpha_status?: Database["public"]["Enums"]["alpha_status"]
          calibration_confidence?: number | null
          calibration_sample_size?: number
          created_at?: string
          created_by?: string | null
          current_alpha?: number
          description?: string | null
          distance_m?: number | null
          elevation_gain_m?: number | null
          elevation_loss_m?: number | null
          gpx_file_url?: string | null
          id?: string
          name: string
          suggested_alpha?: number | null
          surface_type?: Database["public"]["Enums"]["surface_type"]
          technicality_rating?: number | null
          terrain_notes?: string | null
          updated_at?: string
        }
        Update: {
          alpha_last_updated_at?: string | null
          alpha_notes?: string | null
          alpha_status?: Database["public"]["Enums"]["alpha_status"]
          calibration_confidence?: number | null
          calibration_sample_size?: number
          created_at?: string
          created_by?: string | null
          current_alpha?: number
          description?: string | null
          distance_m?: number | null
          elevation_gain_m?: number | null
          elevation_loss_m?: number | null
          gpx_file_url?: string | null
          id?: string
          name?: string
          suggested_alpha?: number | null
          surface_type?: Database["public"]["Enums"]["surface_type"]
          technicality_rating?: number | null
          terrain_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      runs: {
        Row: {
          created_at: string
          distance_km: number
          event_id: string | null
          id: string
          notes: string | null
          photo_url: string | null
          run_date: string
          time_taken_minutes: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          distance_km: number
          event_id?: string | null
          id?: string
          notes?: string | null
          photo_url?: string | null
          run_date?: string
          time_taken_minutes?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          distance_km?: number
          event_id?: string | null
          id?: string
          notes?: string | null
          photo_url?: string | null
          run_date?: string
          time_taken_minutes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      events_public: {
        Row: {
          alpha: number | null
          created_at: string | null
          created_by: string | null
          event_date: string | null
          gpx_file_url: string | null
          id: string | null
          location: string | null
          meetup_time: string | null
          results_published: boolean | null
          route: string | null
          route_distance_m: number | null
          route_elevation_gain_m: number | null
          route_elevation_loss_m: number | null
          title: string | null
        }
        Insert: {
          alpha?: number | null
          created_at?: string | null
          created_by?: string | null
          event_date?: string | null
          gpx_file_url?: string | null
          id?: string | null
          location?: string | null
          meetup_time?: string | null
          results_published?: boolean | null
          route?: string | null
          route_distance_m?: number | null
          route_elevation_gain_m?: number | null
          route_elevation_loss_m?: number | null
          title?: string | null
        }
        Update: {
          alpha?: number | null
          created_at?: string | null
          created_by?: string | null
          event_date?: string | null
          gpx_file_url?: string | null
          id?: string | null
          location?: string | null
          meetup_time?: string | null
          results_published?: boolean | null
          route?: string | null
          route_distance_m?: number | null
          route_elevation_gain_m?: number | null
          route_elevation_loss_m?: number | null
          title?: string | null
        }
        Relationships: []
      }
      routes_public: {
        Row: {
          alpha_status: Database["public"]["Enums"]["alpha_status"] | null
          created_at: string | null
          current_alpha: number | null
          description: string | null
          distance_m: number | null
          elevation_gain_m: number | null
          elevation_loss_m: number | null
          gpx_file_url: string | null
          id: string | null
          name: string | null
          surface_type: Database["public"]["Enums"]["surface_type"] | null
          technicality_rating: number | null
          terrain_notes: string | null
          updated_at: string | null
        }
        Insert: {
          alpha_status?: Database["public"]["Enums"]["alpha_status"] | null
          created_at?: string | null
          current_alpha?: number | null
          description?: string | null
          distance_m?: number | null
          elevation_gain_m?: number | null
          elevation_loss_m?: number | null
          gpx_file_url?: string | null
          id?: string | null
          name?: string | null
          surface_type?: Database["public"]["Enums"]["surface_type"] | null
          technicality_rating?: number | null
          terrain_notes?: string | null
          updated_at?: string | null
        }
        Update: {
          alpha_status?: Database["public"]["Enums"]["alpha_status"] | null
          created_at?: string | null
          current_alpha?: number | null
          description?: string | null
          distance_m?: number | null
          elevation_gain_m?: number | null
          elevation_loss_m?: number | null
          gpx_file_url?: string | null
          id?: string | null
          name?: string | null
          surface_type?: Database["public"]["Enums"]["surface_type"] | null
          technicality_rating?: number | null
          terrain_notes?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      event_results_published: { Args: { _event_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      alpha_history_source: "manual" | "experiment" | "reset"
      alpha_status: "default" | "testing" | "calibrated" | "needs_review"
      app_role: "admin" | "user"
      experiment_status:
        | "proposed"
        | "testing"
        | "approved"
        | "rejected"
        | "archived"
      surface_type: "road" | "trail" | "mixed" | "track" | "gravel"
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
      alpha_history_source: ["manual", "experiment", "reset"],
      alpha_status: ["default", "testing", "calibrated", "needs_review"],
      app_role: ["admin", "user"],
      experiment_status: [
        "proposed",
        "testing",
        "approved",
        "rejected",
        "archived",
      ],
      surface_type: ["road", "trail", "mixed", "track", "gravel"],
    },
  },
} as const
