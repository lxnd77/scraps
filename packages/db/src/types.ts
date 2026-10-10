
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ai_suggestions": {
                  Row: {
                    "confidence": number,"created_at": string,"id": string,"model": string | null,"note_id": string,"space_id": string | null,"status": string,"tags": (string)[],"title": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "confidence": number,"created_at"?: string,"id"?: string,"model"?: string | null,"note_id": string,"space_id"?: string | null,"status"?: string,"tags"?: (string)[],"title"?: string | null,"user_id": string
                  }
                  Update: {
                    "confidence"?: number,"created_at"?: string,"id"?: string,"model"?: string | null,"note_id"?: string,"space_id"?: string | null,"status"?: string,"tags"?: (string)[],"title"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_suggestions_note_id_fkey"
      columns: ["note_id"]
isOneToOne: false
      referencedRelation: "notes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_suggestions_space_id_fkey"
      columns: ["space_id"]
isOneToOne: false
      referencedRelation: "spaces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_suggestions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"assets": {
                  Row: {
                    "bytes": number,"created_at": string,"dominant_color": string | null,"duration_ms": number | null,"height": number | null,"id": string,"kind": string,"mime": string,"note_id": string,"space_id": string,"storage_path": string,"transcript": string | null,"transcript_status": string,"uploader_id": string | null,"waveform": Json | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bytes"?: number,"created_at"?: string,"dominant_color"?: string | null,"duration_ms"?: number | null,"height"?: number | null,"id"?: string,"kind": string,"mime": string,"note_id": string,"space_id": string,"storage_path": string,"transcript"?: string | null,"transcript_status"?: string,"uploader_id"?: string | null,"waveform"?: Json | null,"width"?: number | null
                  }
                  Update: {
                    "bytes"?: number,"created_at"?: string,"dominant_color"?: string | null,"duration_ms"?: number | null,"height"?: number | null,"id"?: string,"kind"?: string,"mime"?: string,"note_id"?: string,"space_id"?: string,"storage_path"?: string,"transcript"?: string | null,"transcript_status"?: string,"uploader_id"?: string | null,"waveform"?: Json | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "assets_note_id_fkey"
      columns: ["note_id"]
isOneToOne: false
      referencedRelation: "notes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assets_space_id_fkey"
      columns: ["space_id"]
isOneToOne: false
      referencedRelation: "spaces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assets_uploader_id_fkey"
      columns: ["uploader_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"capture_tokens": {
                  Row: {
                    "created_at": string,"id": string,"label": string,"last_used_at": string | null,"revoked_at": string | null,"token_hash": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"label"?: string,"last_used_at"?: string | null,"revoked_at"?: string | null,"token_hash": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"label"?: string,"last_used_at"?: string | null,"revoked_at"?: string | null,"token_hash"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "capture_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"link_previews": {
                  Row: {
                    "description": string | null,"domain": string | null,"duration_s": number | null,"fetched_at": string,"image_url": string | null,"lat": number | null,"lng": number | null,"media_type": string,"site_name": string | null,"title": string | null,"url": string,"url_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"domain"?: string | null,"duration_s"?: number | null,"fetched_at"?: string,"image_url"?: string | null,"lat"?: number | null,"lng"?: number | null,"media_type"?: string,"site_name"?: string | null,"title"?: string | null,"url": string,"url_hash": string
                  }
                  Update: {
                    "description"?: string | null,"domain"?: string | null,"duration_s"?: number | null,"fetched_at"?: string,"image_url"?: string | null,"lat"?: number | null,"lng"?: number | null,"media_type"?: string,"site_name"?: string | null,"title"?: string | null,"url"?: string,"url_hash"?: string
                  }
                  Relationships: [
                    
                  ]
                },"note_activity": {
                  Row: {
                    "day": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"user_id": string
                  }
                  Update: {
                    "day"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "note_activity_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"note_docs": {
                  Row: {
                    "note_id": string,"updated_at": string,"ydoc": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "note_id": string,"updated_at"?: string,"ydoc"?: string | null
                  }
                  Update: {
                    "note_id"?: string,"updated_at"?: string,"ydoc"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "note_docs_note_id_fkey"
      columns: ["note_id"]
isOneToOne: true
      referencedRelation: "notes"
      referencedColumns: ["id"]
    }
                  ]
                },"note_tags": {
                  Row: {
                    "note_id": string,"tag_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "note_id": string,"tag_id": string
                  }
                  Update: {
                    "note_id"?: string,"tag_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "note_tags_note_id_fkey"
      columns: ["note_id"]
isOneToOne: false
      referencedRelation: "notes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "note_tags_tag_id_fkey"
      columns: ["tag_id"]
isOneToOne: false
      referencedRelation: "tags"
      referencedColumns: ["id"]
    }
                  ]
                },"notes": {
                  Row: {
                    "color": string,"cover": Json | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"icon_sticker": string | null,"id": string,"kind": string,"last_edited_by": string | null,"meta_clock": NonNullable<Json>,"meta_updated_at": string,"pinned": boolean,"preview": NonNullable<Json>,"preview_text": string,"props": NonNullable<Json>,"search_plain": string | null,"search_text": unknown,"space_id": string,"title": string,"transcript_tsv": unknown,"updated_at": string,"word_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"cover"?: Json | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"icon_sticker"?: string | null,"id"?: string,"kind"?: string,"last_edited_by"?: string | null,"meta_clock"?: NonNullable<Json>,"meta_updated_at"?: string,"pinned"?: boolean,"preview"?: NonNullable<Json>,"preview_text"?: string,"props"?: NonNullable<Json>,"search_plain"?: string | null,"search_text"?: unknown,"space_id": string,"title"?: string,"transcript_tsv"?: unknown,"updated_at"?: string,"word_count"?: number
                  }
                  Update: {
                    "color"?: string,"cover"?: Json | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"icon_sticker"?: string | null,"id"?: string,"kind"?: string,"last_edited_by"?: string | null,"meta_clock"?: NonNullable<Json>,"meta_updated_at"?: string,"pinned"?: boolean,"preview"?: NonNullable<Json>,"preview_text"?: string,"props"?: NonNullable<Json>,"search_plain"?: string | null,"search_text"?: unknown,"space_id"?: string,"title"?: string,"transcript_tsv"?: unknown,"updated_at"?: string,"word_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "notes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notes_last_edited_by_fkey"
      columns: ["last_edited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notes_space_id_fkey"
      columns: ["space_id"]
isOneToOne: false
      referencedRelation: "spaces"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "ai_enabled": boolean,"avatar_sticker": string,"birth_year": number | null,"created_at": string,"default_capture_space": string | null,"display_name": string,"id": string,"onboarded_at": string | null,"theme": string,"tidy_mode": boolean,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_enabled"?: boolean,"avatar_sticker"?: string,"birth_year"?: number | null,"created_at"?: string,"default_capture_space"?: string | null,"display_name"?: string,"id": string,"onboarded_at"?: string | null,"theme"?: string,"tidy_mode"?: boolean,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "ai_enabled"?: boolean,"avatar_sticker"?: string,"birth_year"?: number | null,"created_at"?: string,"default_capture_space"?: string | null,"display_name"?: string,"id"?: string,"onboarded_at"?: string | null,"theme"?: string,"tidy_mode"?: boolean,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_default_capture_space_fkey"
      columns: ["default_capture_space"]
isOneToOne: false
      referencedRelation: "spaces"
      referencedColumns: ["id"]
    }
                  ]
                },"space_invites": {
                  Row: {
                    "created_at": string,"created_by": string,"expires_at": string,"id": string,"max_uses": number,"revoked_at": string | null,"role": string,"space_id": string,"token_hash": string,"uses": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"expires_at"?: string,"id"?: string,"max_uses"?: number,"revoked_at"?: string | null,"role": string,"space_id": string,"token_hash": string,"uses"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"expires_at"?: string,"id"?: string,"max_uses"?: number,"revoked_at"?: string | null,"role"?: string,"space_id"?: string,"token_hash"?: string,"uses"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "space_invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "space_invites_space_id_fkey"
      columns: ["space_id"]
isOneToOne: false
      referencedRelation: "spaces"
      referencedColumns: ["id"]
    }
                  ]
                },"space_members": {
                  Row: {
                    "joined_at": string,"role": string,"space_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "joined_at"?: string,"role": string,"space_id": string,"user_id": string
                  }
                  Update: {
                    "joined_at"?: string,"role"?: string,"space_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "space_members_space_id_fkey"
      columns: ["space_id"]
isOneToOne: false
      referencedRelation: "spaces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "space_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"spaces": {
                  Row: {
                    "color": string,"created_at": string,"deleted_at": string | null,"icon_sticker": string | null,"id": string,"name": string,"owner_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"deleted_at"?: string | null,"icon_sticker"?: string | null,"id"?: string,"name": string,"owner_id": string,"updated_at"?: string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"deleted_at"?: string | null,"icon_sticker"?: string | null,"id"?: string,"name"?: string,"owner_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "spaces_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"tags": {
                  Row: {
                    "color": string,"id": string,"name": string,"space_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"id"?: string,"name": string,"space_id": string
                  }
                  Update: {
                    "color"?: string,"id"?: string,"name"?: string,"space_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tags_space_id_fkey"
      columns: ["space_id"]
isOneToOne: false
      referencedRelation: "spaces"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invite":
{ Args: { "p_token": string }; Returns: string
                           },
"create_invite":
{ Args: { "p_expires_in_days"?: number,"p_max_uses"?: number,"p_role": string,"p_space": string }; Returns: string
                           },
"current_streak":
{ Args: Record<PropertyKey, never>; Returns: {
              "active_today": boolean,"streak": number
            }[]
                           },
"hash_invite_token":
{ Args: { "p_token": string }; Returns: string
                           },
"invite_preview":
{ Args: { "p_token": string }; Returns: {
              "already_member": boolean,"inviter_name": string,"role": string,"space_color": string,"space_name": string
            }[]
                           },
"list_space_members":
{ Args: { "p_space": string }; Returns: {
              "avatar_sticker": string,"display_name": string,"joined_at": string,"role": string,"user_id": string
            }[]
                           },
"media_note_role":
{ Args: { "object_name": string }; Returns: string
                           },
"note_access":
{ Args: { "p_note": string,"p_user": string }; Returns: string
                           },
"note_role":
{ Args: { "note": string }; Returns: string
                           },
"search_notes":
{ Args: { "p_limit"?: number,"p_query": string }; Returns: {
              "color": string,"id": string,"kind": string,"pinned": boolean,"snippet": string,"space_id": string,"title": string,"updated_at": string
            }[]
                           },
"shares_space":
{ Args: { "other": string }; Returns: boolean
                           },
"space_access":
{ Args: { "p_space": string,"p_user": string }; Returns: string
                           },
"space_kind_counts":
{ Args: { "p_space": string }; Returns: {
              "kind": string,"note_count": number
            }[]
                           },
"space_member_avatars":
{ Args: Record<PropertyKey, never>; Returns: {
              "avatar_sticker": string,"display_name": string,"space_id": string,"user_id": string
            }[]
                           },
"space_note_counts":
{ Args: Record<PropertyKey, never>; Returns: {
              "note_count": number,"space_id": string
            }[]
                           },
"space_role":
{ Args: { "space": string }; Returns: string
                           },
"store_note":
{ Args: { "p_edited_by": string,"p_kind": string,"p_note": string,"p_preview": Json,"p_preview_text": string,"p_search": string,"p_title": string,"p_word_count": number,"p_ydoc": string }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
