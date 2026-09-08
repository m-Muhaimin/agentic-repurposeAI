export type Database = {
  public: {
    Views: Record<string, never>;
    Functions: {
      enqueue_job: {
        Args: {
          p_user_id: string;
          p_source_id: string;
          p_formats: string[];
          p_idempotency_key: string | null;
          p_max_jobs_per_month: number | null;
          p_max_outputs_per_job: number;
        };
        Returns: EnqueueJobResult[];
      };
    };
    Tables: {
      sources: {
        Row: { id: string; user_id: string; title: string; storage_path: string | null; source_url: string | null; source_type: "audio" | "video" | "youtube" | "transcript"; status: "uploaded"|"transcribing"|"transcribed"|"generating"|"done"|"failed"; transcript: string | null; error_message: string | null; duration_seconds: number | null; content_hash: string | null; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["sources"]["Row"]> & { user_id: string; title: string; source_type: "audio" | "video" | "youtube" | "transcript" };
        Update: Partial<Database["public"]["Tables"]["sources"]["Row"]>;
        Relationships: [];
      };
      transcripts: {
        Row: { id: string; user_id: string; source_id: string; provider: "assemblyai" | "youtube_captions" | "transcript_file"; language: string | null; duration_seconds: number | null; status: "processing"|"ready"|"failed"; content: string; error_message: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["transcripts"]["Row"]> & { user_id: string; source_id: string; provider: "assemblyai" | "youtube_captions" | "transcript_file"; content: string };
        Update: Partial<Database["public"]["Tables"]["transcripts"]["Row"]>;
        Relationships: [];
      };
      outputs: {
        Row: { id: string; source_id: string; user_id: string; format: "linkedin_post"|"newsletter"|"shortform_script"; content: string; regeneration_count: number; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["outputs"]["Row"]> & { source_id: string; user_id: string; format: "linkedin_post"|"newsletter"|"shortform_script"; content: string };
        Update: Partial<Database["public"]["Tables"]["outputs"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "outputs_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          }
        ];
      };
      jobs: {
        Row: { id: string; user_id: string; source_id: string; status: "queued"|"running"|"done"|"failed"; attempt: number; formats: string[] | null; idempotency_key: string | null; refunded: boolean; error_message: string | null; created_at: string; started_at: string | null; finished_at: string | null };
        Insert: Partial<Database["public"]["Tables"]["jobs"]["Row"]> & { user_id: string; source_id: string };
        Update: Partial<Database["public"]["Tables"]["jobs"]["Row"]>;
        Relationships: [];
      };
      user_prompts: {
        Row: { user_id: string; format: string; prompt: string; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["user_prompts"]["Row"]> & { user_id: string; format: string; prompt: string };
        Update: Partial<Database["public"]["Tables"]["user_prompts"]["Row"]>;
        Relationships: [];
      };
      youtube_connections: {
        Row: { id: string; user_id: string; channel_id: string; channel_title: string; uploads_playlist_id: string; refresh_token: string; access_token: string | null; access_token_expires_at: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["youtube_connections"]["Row"]> & { user_id: string; channel_id: string; channel_title: string; refresh_token: string };
        Update: Partial<Database["public"]["Tables"]["youtube_connections"]["Row"]>;
        Relationships: [];
      };
      buffer_connections: {
        Row: { id: string; user_id: string; buffer_account_id: string; buffer_username: string; access_token: string; refresh_token: string | null; access_token_expires_at: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["buffer_connections"]["Row"]> & { user_id: string; buffer_account_id: string; buffer_username: string; access_token: string };
        Update: Partial<Database["public"]["Tables"]["buffer_connections"]["Row"]>;
        Relationships: [];
      };
      profiles: {
        Row: { user_id: string; plan: "beta"|"creator"|"pro"|"studio"; plan_status: "active"|"cancelled"; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      events: {
        Row: { id: number; name: string; user_id: string | null; properties: Record<string, unknown>; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["events"]["Row"]> & { name: string };
        Update: Partial<Database["public"]["Tables"]["events"]["Row"]>;
        Relationships: [];
      };
      usage_events: {
        Row: { id: number; user_id: string; job_id: string | null; action: "reserve"|"consume"|"refund"|"release"; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["usage_events"]["Row"]> & { user_id: string; action: "reserve"|"consume"|"refund"|"release" };
        Update: Partial<Database["public"]["Tables"]["usage_events"]["Row"]>;
        Relationships: [];
      };
      subscriptions: {
        Row: { id: string; user_id: string; plan: "creator"|"pro"|"studio"; status: "incomplete"|"active"|"past_due"|"canceled"|"trialing"; provider: string | null; provider_subscription_id: string | null; current_period_start: string | null; current_period_end: string | null; cancel_at: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]> & { user_id: string; plan: "creator"|"pro"|"studio" };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]>;
        Relationships: [];
      };
      subscription_events: {
        Row: { id: number; subscription_id: string | null; user_id: string | null; type: string; payload: Record<string, unknown>; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["subscription_events"]["Row"]> & { type: string };
        Update: Partial<Database["public"]["Tables"]["subscription_events"]["Row"]>;
        Relationships: [];
      };
      v4_agent_runs: {
        Row: { id: string; user_id: string; source_id: string; mode: "assist"|"execute"|"automate"; status: "created"|"planning"|"awaiting_approval"|"executing"|"evaluating"|"done"|"failed"|"cancelled"; plan: unknown; transcript_snapshot: string | null; input_tokens: number; output_tokens: number; cost_units: number; step_count: number; output_ids: string[]; error_message: string | null; attempt: number; approval_decision: string | null; created_at: string; updated_at: string; started_at: string | null; finished_at: string | null; max_steps: number; max_cost_units: number; max_runtime_s: number; heartbeat_at: string | null };
        Insert: Partial<Database["public"]["Tables"]["v4_agent_runs"]["Row"]> & { user_id: string; source_id: string };
        Update: Partial<Database["public"]["Tables"]["v4_agent_runs"]["Row"]>;
        Relationships: [{ foreignKeyName: "v4_agent_runs_source_id_fkey"; columns: ["source_id"]; isOneToOne: false; referencedRelation: "sources"; referencedColumns: ["id"] }];
      };
      v4_agent_steps: {
        Row: { id: string; run_id: string; user_id: string; kind: "planning"|"source"|"generation"|"review"|"distribution"|"strategy"; status: "pending"|"running"|"done"|"failed"|"skipped"; label: string | null; input: unknown; output: unknown; retry_count: number; started_at: string | null; finished_at: string | null; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["v4_agent_steps"]["Row"]> & { run_id: string; user_id: string; kind: "planning"|"source"|"generation"|"review"|"distribution"|"strategy" };
        Update: Partial<Database["public"]["Tables"]["v4_agent_steps"]["Row"]>;
        Relationships: [{ foreignKeyName: "v4_agent_steps_run_id_fkey"; columns: ["run_id"]; isOneToOne: false; referencedRelation: "v4_agent_runs"; referencedColumns: ["id"] }];
      };
      v4_content_ideas: {
        Row: { id: string; run_id: string; user_id: string; title: string; description: string | null; suggested_formats: string[]; quotes: string[]; rationale: string | null; approved: boolean; sort_order: number; evaluation: unknown; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["v4_content_ideas"]["Row"]> & { run_id: string; user_id: string; title: string };
        Update: Partial<Database["public"]["Tables"]["v4_content_ideas"]["Row"]>;
        Relationships: [{ foreignKeyName: "v4_content_ideas_run_id_fkey"; columns: ["run_id"]; isOneToOne: false; referencedRelation: "v4_agent_runs"; referencedColumns: ["id"] }];
      };
      v4_agent_preferences: {
        Row: { id: string; user_id: string; auto_mode: "assist"|"execute"|"automate"; brand_tone: string; brand_forbidden_phrases: string[]; brand_examples: string[]; brand_samples: string | null; edit_signals: unknown; content_strategy: unknown; updated_at: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["v4_agent_preferences"]["Row"]> & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["v4_agent_preferences"]["Row"]>;
        Relationships: [];
      };
      v4_distribution_jobs: {
        Row: { id: string; user_id: string; run_id: string | null; output_id: string | null; platform: "linkedin"|"x"|"newsletter"|"youtube_shorts"|"tiktok"|"instagram"; status: "draft"|"scheduled"|"published"|"failed"|"cancelled"; scheduled_at: string | null; published_at: string | null; external_id: string | null; error_message: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["v4_distribution_jobs"]["Row"]> & { user_id: string; platform: "linkedin"|"x"|"newsletter"|"youtube_shorts"|"tiktok"|"instagram" };
        Update: Partial<Database["public"]["Tables"]["v4_distribution_jobs"]["Row"]>;
        Relationships: [];
      };
      v4_content_strategies: {
        Row: { id: string; user_id: string; title: string; body: string; source: "heuristic"|"planner"|"manual"; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["v4_content_strategies"]["Row"]> & { user_id: string; title: string; body: string };
        Update: Partial<Database["public"]["Tables"]["v4_content_strategies"]["Row"]>;
        Relationships: [];
      };
    };
  };
};

type EnqueueJobResult = {
  job_id: string | null;
  created_new: boolean;
  jobs_used: number;
  jobs_limit_reached: boolean;
  error_code: string | null;
};