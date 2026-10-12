
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
            "activity": {
                  Row: {
                    "created_at": string,"id": string,"message": string,"team_id": string | null,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"message": string,"team_id"?: string | null,"type": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"message"?: string,"team_id"?: string | null,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "leaderboard_view"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "activity_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_status"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"admins": {
                  Row: {
                    "user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "user_id": string
                  }
                  Update: {
                    "user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"bugx_attempts": {
                  Row: {
                    "attempt_hash": string,"created_at": string | null,"id": string,"success": boolean,"team_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_hash": string,"created_at"?: string | null,"id"?: string,"success": boolean,"team_id"?: string | null
                  }
                  Update: {
                    "attempt_hash"?: string,"created_at"?: string | null,"id"?: string,"success"?: boolean,"team_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bugx_attempts_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "leaderboard_view"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "bugx_attempts_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_status"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bugx_attempts_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"bugx_solves": {
                  Row: {
                    "auto_points": number | null,"rank": number,"solved_at": string | null,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_points"?: number | null,"rank": number,"solved_at"?: string | null,"team_id": string
                  }
                  Update: {
                    "auto_points"?: number | null,"rank"?: number,"solved_at"?: string | null,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bugx_solves_team_id_fkey"
      columns: ["team_id"]
isOneToOne: true
      referencedRelation: "leaderboard_view"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "bugx_solves_team_id_fkey"
      columns: ["team_id"]
isOneToOne: true
      referencedRelation: "team_status"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bugx_solves_team_id_fkey"
      columns: ["team_id"]
isOneToOne: true
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"event_state": {
                  Row: {
                    "announcement": string | null,"current_stage": number,"id": number,"paused_at": string | null,"registration_deadline": string,"remaining_ms": number | null,"scores_locked_stage": (number)[],"stage_ends_at": string | null,"stage_started_at": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "announcement"?: string | null,"current_stage"?: number,"id"?: number,"paused_at"?: string | null,"registration_deadline": string,"remaining_ms"?: number | null,"scores_locked_stage"?: (number)[],"stage_ends_at"?: string | null,"stage_started_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "announcement"?: string | null,"current_stage"?: number,"id"?: number,"paused_at"?: string | null,"registration_deadline"?: string,"remaining_ms"?: number | null,"scores_locked_stage"?: (number)[],"stage_ends_at"?: string | null,"stage_started_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"members": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"name": string,"phone": string | null,"reg_no": string,"role": string,"section": string | null,"team_id": string,"year": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"id"?: string,"name": string,"phone"?: string | null,"reg_no": string,"role": string,"section"?: string | null,"team_id": string,"year"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"name"?: string,"phone"?: string | null,"reg_no"?: string,"role"?: string,"section"?: string | null,"team_id"?: string,"year"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_members_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "leaderboard_view"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "team_members_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_status"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_members_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"rubric_scores": {
                  Row: {
                    "comment": string | null,"criteria": Json | null,"id": string,"judge_id": string,"stage_slug": string | null,"team_id": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "comment"?: string | null,"criteria"?: Json | null,"id"?: string,"judge_id": string,"stage_slug"?: string | null,"team_id"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "comment"?: string | null,"criteria"?: Json | null,"id"?: string,"judge_id"?: string,"stage_slug"?: string | null,"team_id"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "rubric_scores_stage_slug_fkey"
      columns: ["stage_slug"]
isOneToOne: false
      referencedRelation: "stages"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "rubric_scores_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "leaderboard_view"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "rubric_scores_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_status"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rubric_scores_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"score_audit": {
                  Row: {
                    "admin_id": string | null,"created_at": string,"id": string,"new_points": number | null,"note": string | null,"old_points": number | null,"stage": number,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_id"?: string | null,"created_at"?: string,"id"?: string,"new_points"?: number | null,"note"?: string | null,"old_points"?: number | null,"stage": number,"team_id": string
                  }
                  Update: {
                    "admin_id"?: string | null,"created_at"?: string,"id"?: string,"new_points"?: number | null,"note"?: string | null,"old_points"?: number | null,"stage"?: number,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "score_audit_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "leaderboard_view"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "score_audit_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_status"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "score_audit_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"scores": {
                  Row: {
                    "created_at": string,"detail": Json | null,"id": string,"points": number,"stage": number,"team_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"detail"?: Json | null,"id"?: string,"points"?: number,"stage": number,"team_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"detail"?: Json | null,"id"?: string,"points"?: number,"stage"?: number,"team_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "scores_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "leaderboard_view"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "scores_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_status"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scores_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"stage_assets": {
                  Row: {
                    "assign_mode": string | null,"id": string,"kind": string,"label": string | null,"meta": Json | null,"release": string | null,"sort": number | null,"stage_slug": string | null,"storage_path": string | null,"text_value": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assign_mode"?: string | null,"id"?: string,"kind": string,"label"?: string | null,"meta"?: Json | null,"release"?: string | null,"sort"?: number | null,"stage_slug"?: string | null,"storage_path"?: string | null,"text_value"?: string | null
                  }
                  Update: {
                    "assign_mode"?: string | null,"id"?: string,"kind"?: string,"label"?: string | null,"meta"?: Json | null,"release"?: string | null,"sort"?: number | null,"stage_slug"?: string | null,"storage_path"?: string | null,"text_value"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stage_assets_stage_slug_fkey"
      columns: ["stage_slug"]
isOneToOne: false
      referencedRelation: "stages"
      referencedColumns: ["slug"]
    }
                  ]
                },"stage_assignments": {
                  Row: {
                    "asset_id": string | null,"extra": Json | null,"stage_slug": string | null,"team_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_id"?: string | null,"extra"?: Json | null,"stage_slug"?: string | null,"team_id"?: string | null
                  }
                  Update: {
                    "asset_id"?: string | null,"extra"?: Json | null,"stage_slug"?: string | null,"team_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stage_assignments_asset_id_fkey"
      columns: ["asset_id"]
isOneToOne: false
      referencedRelation: "stage_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stage_assignments_stage_slug_fkey"
      columns: ["stage_slug"]
isOneToOne: false
      referencedRelation: "stages"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "stage_assignments_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "leaderboard_view"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "stage_assignments_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_status"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stage_assignments_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"stage_secrets": {
                  Row: {
                    "bugx_form_url": string | null,"bugx_password_hash": string | null,"bugx_pdf_asset_id": string | null,"stage_slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bugx_form_url"?: string | null,"bugx_password_hash"?: string | null,"bugx_pdf_asset_id"?: string | null,"stage_slug": string
                  }
                  Update: {
                    "bugx_form_url"?: string | null,"bugx_password_hash"?: string | null,"bugx_pdf_asset_id"?: string | null,"stage_slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stage_secrets_stage_slug_fkey"
      columns: ["stage_slug"]
isOneToOne: true
      referencedRelation: "stages"
      referencedColumns: ["slug"]
    }
                  ]
                },"stages": {
                  Row: {
                    "duration_min": number | null,"faq": Json | null,"hook": string | null,"name": string,"number": number,"overview_md": string | null,"phases": Json | null,"roles_md": string | null,"rubric": Json | null,"rules_md": string | null,"slug": string,"status": string | null,"submission_config": Json | null,"tests": (string)[] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_min"?: number | null,"faq"?: Json | null,"hook"?: string | null,"name": string,"number": number,"overview_md"?: string | null,"phases"?: Json | null,"roles_md"?: string | null,"rubric"?: Json | null,"rules_md"?: string | null,"slug": string,"status"?: string | null,"submission_config"?: Json | null,"tests"?: (string)[] | null
                  }
                  Update: {
                    "duration_min"?: number | null,"faq"?: Json | null,"hook"?: string | null,"name"?: string,"number"?: number,"overview_md"?: string | null,"phases"?: Json | null,"roles_md"?: string | null,"rubric"?: Json | null,"rules_md"?: string | null,"slug"?: string,"status"?: string | null,"submission_config"?: Json | null,"tests"?: (string)[] | null
                  }
                  Relationships: [
                    
                  ]
                },"submissions": {
                  Row: {
                    "created_at": string | null,"id": string,"kind": string,"member_id": string | null,"meta": Json | null,"prompts_text": string | null,"stage_slug": string | null,"storage_path": string | null,"team_id": string | null,"text_value": string | null,"url": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"id"?: string,"kind": string,"member_id"?: string | null,"meta"?: Json | null,"prompts_text"?: string | null,"stage_slug"?: string | null,"storage_path"?: string | null,"team_id"?: string | null,"text_value"?: string | null,"url"?: string | null,"version": number
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"kind"?: string,"member_id"?: string | null,"meta"?: Json | null,"prompts_text"?: string | null,"stage_slug"?: string | null,"storage_path"?: string | null,"team_id"?: string | null,"text_value"?: string | null,"url"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "submissions_stage_slug_fkey"
      columns: ["stage_slug"]
isOneToOne: false
      referencedRelation: "stages"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "submissions_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "leaderboard_view"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "submissions_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_status"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "submissions_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "captain_id": string | null,"code": string,"created_at": string,"id": string,"name": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "captain_id"?: string | null,"code": string,"created_at"?: string,"id"?: string,"name": string,"status"?: string
                  }
                  Update: {
                    "captain_id"?: string | null,"code"?: string,"created_at"?: string,"id"?: string,"name"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_captain_fk"
      columns: ["captain_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "leaderboard_view": {
                  Row: {
                    "member_count": number | null,"member_initials": (string)[] | null,"name": string | null,"rank": number | null,"s1": number | null,"s2": number | null,"s3": number | null,"s4": number | null,"team_id": string | null,"total": number | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"team_status": {
                  Row: {
                    "id": string | null,"invite_code": string | null,"is_full": boolean | null,"meets_minimum": boolean | null,"member_count": number | null,"name": string | null,"status": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "admin_add_member":
{ Args: { "p_email": string,"p_name": string,"p_phone"?: string,"p_reg_no": string,"p_section"?: string,"p_team_id": string,"p_year"?: number }; Returns: string
                           },
"admin_delete_team":
{ Args: { "p_team_id": string }; Returns: undefined
                           },
"admin_end_stage":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"admin_extend":
{ Args: { "p_seconds": number }; Returns: undefined
                           },
"admin_get_teams":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_list_score_audit":
{ Args: { "p_limit"?: number,"p_stage"?: number,"p_team_id"?: string }; Returns: Json
                           },
"admin_lock_stage":
{ Args: { "p_locked": boolean,"p_stage": number }; Returns: undefined
                           },
"admin_move_member":
{ Args: { "p_member_id": string,"p_to_team_id": string }; Returns: undefined
                           },
"admin_pause":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"admin_remove_member":
{ Args: { "p_member_id": string }; Returns: undefined
                           },
"admin_rename_team":
{ Args: { "p_new_name": string,"p_team_id": string }; Returns: undefined
                           },
"admin_resume":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"admin_set_announcement":
{ Args: { "p_text": string }; Returns: undefined
                           },
"admin_set_event_status":
{ Args: { "p_status": string }; Returns: undefined
                           },
"admin_set_registration_deadline":
{ Args: { "p_ts": string }; Returns: undefined
                           },
"admin_set_score":
{ Args: { "p_force"?: boolean,"p_note"?: string,"p_points": number,"p_stage": number,"p_team_id": string }; Returns: undefined
                           },
"admin_set_stage":
{ Args: { "p_duration_seconds": number,"p_stage": number }; Returns: undefined
                           },
"admin_undo_last_score":
{ Args: { "p_stage": number,"p_team_id": string }; Returns: undefined
                           },
"create_team":
{ Args: { "p_captain_name": string,"p_email"?: string,"p_reg_no"?: string,"p_section"?: string,"p_team_name": string,"p_year"?: number }; Returns: Json
                           },
"generate_team_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"get_team_lobby":
{ Args: { "p_code": string,"p_reg_no"?: string }; Returns: Json
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_allowed_email":
{ Args: { "p_email": string }; Returns: boolean
                           },
"is_allowed_year":
{ Args: { "p_year": number }; Returns: boolean
                           },
"join_team":
{ Args: { "p_code": string,"p_email"?: string,"p_member_name": string,"p_phone"?: string,"p_reg_no"?: string,"p_section"?: string,"p_year"?: number }; Returns: Json
                           },
"remove_member":
{ Args: { "p_captain_reg_no": string,"p_code": string,"p_member_name": string }; Returns: Json
                           },
"rename_team":
{ Args: { "p_captain_reg_no": string,"p_code": string,"p_new_name": string }; Returns: Json
                           },
"server_now":
{ Args: Record<PropertyKey, never>; Returns: string
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
