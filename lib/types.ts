export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      coin_ledger: {
        Row: {
          actor: Database["public"]["Enums"]["person"]
          amount: number
          created_at: string
          id: number
          reason: string
          ref_id: string | null
        }
        Insert: {
          actor: Database["public"]["Enums"]["person"]
          amount: number
          created_at?: string
          id?: number
          reason: string
          ref_id?: string | null
        }
        Update: {
          actor?: Database["public"]["Enums"]["person"]
          amount?: number
          created_at?: string
          id?: number
          reason?: string
          ref_id?: string | null
        }
        Relationships: []
      }
      coin_rules: {
        Row: {
          amount: number
          daily_cap: number | null
          label: string
          min_units: number
          reason: string
        }
        Insert: {
          amount: number
          daily_cap?: number | null
          label: string
          min_units?: number
          reason: string
        }
        Update: {
          amount?: number
          daily_cap?: number | null
          label?: string
          min_units?: number
          reason?: string
        }
        Relationships: []
      }
      couple_state: {
        Row: {
          coins: number
          id: number
          theme: string
          updated_at: string
        }
        Insert: {
          coins?: number
          id?: number
          theme?: string
          updated_at?: string
        }
        Update: {
          coins?: number
          id?: number
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      game_matches: {
        Row: {
          closed_at: string | null
          created_at: string
          current_turn: Database["public"]["Enums"]["person"]
          game_type: Database["public"]["Enums"]["game_type"]
          id: string
          started_by: Database["public"]["Enums"]["person"]
          state: Json
          winner: Database["public"]["Enums"]["person"] | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          current_turn: Database["public"]["Enums"]["person"]
          game_type: Database["public"]["Enums"]["game_type"]
          id?: string
          started_by: Database["public"]["Enums"]["person"]
          state: Json
          winner?: Database["public"]["Enums"]["person"] | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          current_turn?: Database["public"]["Enums"]["person"]
          game_type?: Database["public"]["Enums"]["game_type"]
          id?: string
          started_by?: Database["public"]["Enums"]["person"]
          state?: Json
          winner?: Database["public"]["Enums"]["person"] | null
        }
        Relationships: []
      }
      item_prices: {
        Row: {
          cost: number
          key: string
          label: string
        }
        Insert: {
          cost: number
          key: string
          label: string
        }
        Update: {
          cost?: number
          key?: string
          label?: string
        }
        Relationships: []
      }
      letters: {
        Row: {
          author: Database["public"]["Enums"]["person"]
          body: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["letter_kind"]
          read_at: string | null
          strokes: Json | null
        }
        Insert: {
          author: Database["public"]["Enums"]["person"]
          body?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["letter_kind"]
          read_at?: string | null
          strokes?: Json | null
        }
        Update: {
          author?: Database["public"]["Enums"]["person"]
          body?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["letter_kind"]
          read_at?: string | null
          strokes?: Json | null
        }
        Relationships: []
      }
      owned_items: {
        Row: {
          key: string
          purchased_at: string
        }
        Insert: {
          key: string
          purchased_at?: string
        }
        Update: {
          key?: string
          purchased_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owned_items_key_fkey"
            columns: ["key"]
            isOneToOne: true
            referencedRelation: "item_prices"
            referencedColumns: ["key"]
          },
        ]
      }
      pets: {
        Row: {
          active_skin: string | null
          kind: Database["public"]["Enums"]["pet_kind"]
          nickname: string | null
          species_key: string
          stats: Json
          unlocked_at: string
          updated_at: string
        }
        Insert: {
          active_skin?: string | null
          kind: Database["public"]["Enums"]["pet_kind"]
          nickname?: string | null
          species_key: string
          stats: Json
          unlocked_at?: string
          updated_at?: string
        }
        Update: {
          active_skin?: string | null
          kind?: Database["public"]["Enums"]["pet_kind"]
          nickname?: string | null
          species_key?: string
          stats?: Json
          unlocked_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pets_species_key_fkey"
            columns: ["species_key"]
            isOneToOne: true
            referencedRelation: "item_prices"
            referencedColumns: ["key"]
          },
        ]
      }
      question_answers: {
        Row: {
          answered_at: string
          author: Database["public"]["Enums"]["person"]
          body: string
          round_id: string
        }
        Insert: {
          answered_at?: string
          author: Database["public"]["Enums"]["person"]
          body: string
          round_id: string
        }
        Update: {
          answered_at?: string
          author?: Database["public"]["Enums"]["person"]
          body?: string
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_answers_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "question_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      question_rounds: {
        Row: {
          closed_at: string | null
          closed_by: Database["public"]["Enums"]["person"] | null
          closed_reason: string | null
          drawn_at: string
          drawn_by: Database["public"]["Enums"]["person"]
          id: string
          question_id: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: Database["public"]["Enums"]["person"] | null
          closed_reason?: string | null
          drawn_at?: string
          drawn_by: Database["public"]["Enums"]["person"]
          id?: string
          question_id: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: Database["public"]["Enums"]["person"] | null
          closed_reason?: string | null
          drawn_at?: string
          drawn_by?: Database["public"]["Enums"]["person"]
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_rounds_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          body: string
          category: Database["public"]["Enums"]["question_category"]
          id: string
        }
        Insert: {
          body: string
          category: Database["public"]["Enums"]["question_category"]
          id?: string
        }
        Update: {
          body?: string
          category?: Database["public"]["Enums"]["question_category"]
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      answer_question: {
        Args: {
          p_body: string
          p_person: Database["public"]["Enums"]["person"]
          p_round_id: string
        }
        Returns: {
          answered_at: string
          author: Database["public"]["Enums"]["person"]
          body: string
          round_id: string
        }
        SetofOptions: {
          from: "*"
          to: "question_answers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assert_valid_strokes: { Args: { p_strokes: Json }; Returns: undefined }
      care_for_pet: {
        Args: {
          p_actor: Database["public"]["Enums"]["person"]
          p_species_key: string
          p_stats: Json
        }
        Returns: {
          active_skin: string | null
          kind: Database["public"]["Enums"]["pet_kind"]
          nickname: string | null
          species_key: string
          stats: Json
          unlocked_at: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_letter: {
        Args: {
          p_author: Database["public"]["Enums"]["person"]
          p_body?: string
          p_kind: Database["public"]["Enums"]["letter_kind"]
          p_strokes?: Json
        }
        Returns: {
          author: Database["public"]["Enums"]["person"]
          body: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["letter_kind"]
          read_at: string | null
          strokes: Json | null
        }
        SetofOptions: {
          from: "*"
          to: "letters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_match: {
        Args: {
          p_game_type: Database["public"]["Enums"]["game_type"]
          p_initial_state: Json
          p_person: Database["public"]["Enums"]["person"]
        }
        Returns: {
          closed_at: string | null
          created_at: string
          current_turn: Database["public"]["Enums"]["person"]
          game_type: Database["public"]["Enums"]["game_type"]
          id: string
          started_by: Database["public"]["Enums"]["person"]
          state: Json
          winner: Database["public"]["Enums"]["person"] | null
        }
        SetofOptions: {
          from: "*"
          to: "game_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      draw_question: {
        Args: {
          p_category?: Database["public"]["Enums"]["question_category"]
          p_person: Database["public"]["Enums"]["person"]
        }
        Returns: {
          closed_at: string | null
          closed_by: Database["public"]["Enums"]["person"] | null
          closed_reason: string | null
          drawn_at: string
          drawn_by: Database["public"]["Enums"]["person"]
          id: string
          question_id: string
        }
        SetofOptions: {
          from: "*"
          to: "question_rounds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      grant_coins: {
        Args: {
          p_actor: Database["public"]["Enums"]["person"]
          p_reason: string
          p_ref?: string
          p_units?: number
        }
        Returns: number
      }
      make_move: {
        Args: {
          p_match_id: string
          p_person: Database["public"]["Enums"]["person"]
          p_result?: string
          p_state: Json
          p_winner?: Database["public"]["Enums"]["person"]
        }
        Returns: {
          closed_at: string | null
          created_at: string
          current_turn: Database["public"]["Enums"]["person"]
          game_type: Database["public"]["Enums"]["game_type"]
          id: string
          started_by: Database["public"]["Enums"]["person"]
          state: Json
          winner: Database["public"]["Enums"]["person"] | null
        }
        SetofOptions: {
          from: "*"
          to: "game_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_letter_read: {
        Args: { p_id: string; p_reader: Database["public"]["Enums"]["person"] }
        Returns: undefined
      }
      purchase_item: {
        Args: {
          p_actor: Database["public"]["Enums"]["person"]
          p_item_key: string
        }
        Returns: undefined
      }
      rename_pet: {
        Args: { p_name: string; p_species_key: string }
        Returns: {
          active_skin: string | null
          kind: Database["public"]["Enums"]["pet_kind"]
          nickname: string | null
          species_key: string
          stats: Json
          unlocked_at: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      select_pet_skin: {
        Args: { p_skin_key: string | null; p_species_key: string }
        Returns: {
          active_skin: string | null
          kind: Database["public"]["Enums"]["pet_kind"]
          nickname: string | null
          species_key: string
          stats: Json
          unlocked_at: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      select_theme: { Args: { p_theme_key: string }; Returns: undefined }
      skip_question: {
        Args: {
          p_person: Database["public"]["Enums"]["person"]
          p_round_id: string
        }
        Returns: boolean
      }
      spend_coins: {
        Args: {
          p_actor: Database["public"]["Enums"]["person"]
          p_item_key: string
        }
        Returns: number
      }
      unlock_pet: {
        Args: {
          p_actor: Database["public"]["Enums"]["person"]
          p_initial_stats: Json
          p_kind: Database["public"]["Enums"]["pet_kind"]
          p_species_key: string
        }
        Returns: {
          active_skin: string | null
          kind: Database["public"]["Enums"]["pet_kind"]
          nickname: string | null
          species_key: string
          stats: Json
          unlocked_at: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      game_type: "tic_tac_toe" | "connect_four" | "trivia" | "goose"
      letter_kind: "text" | "drawing"
      person: "fabrizio" | "emily"
      pet_kind: "animal" | "plant"
      question_category: "deep" | "spicy" | "about_us" | "hypothetical" | "fun"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      game_type: ["tic_tac_toe", "connect_four", "trivia", "goose"],
      letter_kind: ["text", "drawing"],
      person: ["fabrizio", "emily"],
      pet_kind: ["animal", "plant"],
      question_category: ["deep", "spicy", "about_us", "hypothetical", "fun"],
    },
  },
} as const

