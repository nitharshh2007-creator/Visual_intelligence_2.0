-- Migration 0004: Phase 3 Admin-Uploaded Challenge Content

-- 1. STAGES config table
CREATE TABLE IF NOT EXISTS public.stages (
  slug text PRIMARY KEY,
  number int NOT NULL,
  name text NOT NULL,
  hook text,
  tests text[],
  duration_min int,
  overview_md text,
  rules_md text,
  roles_md text,
  faq jsonb DEFAULT '[]'::jsonb,
  rubric jsonb DEFAULT '[]'::jsonb,
  phases jsonb DEFAULT '[]'::jsonb,
  submission_config jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'draft'
);

-- 2. STAGE_ASSETS table
CREATE TABLE IF NOT EXISTS public.stage_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_slug text REFERENCES public.stages(slug) ON DELETE CASCADE,
  kind text NOT NULL,
  label text,
  sort int DEFAULT 0,
  storage_path text,
  text_value text,
  release text DEFAULT 'public',
  assign_mode text DEFAULT 'all',
  meta jsonb DEFAULT '{}'::jsonb
);

-- 3. STAGE_ASSIGNMENTS table
CREATE TABLE IF NOT EXISTS public.stage_assignments (
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  stage_slug text REFERENCES public.stages(slug) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.stage_assets(id) ON DELETE CASCADE,
  extra jsonb DEFAULT '{}'::jsonb,
  UNIQUE(team_id, stage_slug, asset_id)
);

-- 4. STAGE_SECRETS table (Admin ONLY)
CREATE TABLE IF NOT EXISTS public.stage_secrets (
  stage_slug text PRIMARY KEY REFERENCES public.stages(slug) ON DELETE CASCADE,
  bugx_password_hash text,
  bugx_form_url text,
  bugx_pdf_asset_id uuid
);

-- 5. SUBMISSIONS table
CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  stage_slug text REFERENCES public.stages(slug) ON DELETE CASCADE,
  version int NOT NULL,
  kind text NOT NULL,
  storage_path text,
  url text,
  text_value text,
  prompts_text text,
  member_id text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, stage_slug, version)
);

-- 6. BUGX tracking
CREATE TABLE IF NOT EXISTS public.bugx_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  attempt_hash text NOT NULL,
  success boolean NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bugx_solves (
  team_id uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  solved_at timestamptz DEFAULT now(),
  rank int NOT NULL,
  auto_points numeric
);

-- 7. RUBRIC_SCORES
CREATE TABLE IF NOT EXISTS public.rubric_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  stage_slug text REFERENCES public.stages(slug) ON DELETE CASCADE,
  judge_id text NOT NULL,
  criteria jsonb DEFAULT '{}'::jsonb,
  comment text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(team_id, stage_slug, judge_id)
);

-- RLS: Block all public access for now
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bugx_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bugx_solves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin bypass stages" ON public.stages USING (is_admin());
CREATE POLICY "Admin bypass stage_assets" ON public.stage_assets USING (is_admin());
CREATE POLICY "Admin bypass stage_assignments" ON public.stage_assignments USING (is_admin());
CREATE POLICY "Admin bypass stage_secrets" ON public.stage_secrets USING (is_admin());
CREATE POLICY "Admin bypass submissions" ON public.submissions USING (is_admin());
CREATE POLICY "Admin bypass bugx_attempts" ON public.bugx_attempts USING (is_admin());
CREATE POLICY "Admin bypass bugx_solves" ON public.bugx_solves USING (is_admin());
CREATE POLICY "Admin bypass rubric_scores" ON public.rubric_scores USING (is_admin());

-- Insert storage buckets (requires superuser typically, but we simulate it in local)
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('stage-assets', 'stage-assets', false),
  ('submissions', 'submissions', false)
ON CONFLICT (id) DO NOTHING;

-- Seed the stages
INSERT INTO public.stages (slug, number, name, hook, tests, duration_min, overview_md, rules_md, roles_md, phases)
VALUES 
  ('cyber-styling', 1, 'CYBER STYLING', 'Same HTML file, different themes. Teams use GenAI to redesign it.', ARRAY['Prompting', 'coding', 'creativity'], 25, 'Teams use GenAI to redesign an HTML file based on their assigned theme.', 'No direct coding, use GenAI. Must stick to theme.', 'Prompt Lead, Code Integrator, Designer, Tester, Submitter', '[{"name": "Brief", "minutes": 3, "accepts_submission": false, "releases": ["theme_card"]}, {"name": "Build", "minutes": 18, "accepts_submission": true, "releases": ["html_base"]}, {"name": "Submit", "minutes": 4, "accepts_submission": true, "releases": []}]'::jsonb),
  ('bugx-hacker', 2, 'BUGX HACKER', 'Teams solve a bug/clue hidden across 10 files → password → PDF → Google Form.', ARRAY['Debugging', 'logic', 'AI problem-solving'], 30, 'Hunt for clues across 10 buggy files.', 'No brute forcing.', 'Two Debuggers, Logic Solver, AI Prompter, Password Keeper', '[{"name": "Brief", "minutes": 3, "accepts_submission": false, "releases": []}, {"name": "Hunt", "minutes": 22, "accepts_submission": true, "releases": ["bug_file", "bug_pdf"]}, {"name": "Form", "minutes": 5, "accepts_submission": true, "releases": []}]'::jsonb),
  ('prompt-rumble', 3, 'PROMPT RUMBLE', '10 images + 10 words: create a 30-second AI advertisement in 20 minutes.', ARRAY['Prompting', 'creativity', 'multimodal AI'], 40, 'Create a video using 10 words and images.', 'Use all words. Video exactly 30 seconds.', 'Director, Image Prompters, Script/Voice, Video Assembler', '[{"name": "Brief", "minutes": 5, "accepts_submission": false, "releases": ["rumble_image", "rumble_word"]}, {"name": "Create", "minutes": 20, "accepts_submission": true, "releases": []}, {"name": "Submit & Review", "minutes": 15, "accepts_submission": true, "releases": []}]'::jsonb),
  ('prompt-charades', 4, 'PROMPT CHARADES', 'One member can''t see the image. The team describes or acts it, then generates it with AI.', ARRAY['Communication', 'visual understanding', 'prompting'], 25, 'The blind member generates the image without seeing it.', 'Prompter cannot look at the target.', 'Blind Generator, Describers, Actor, Prompt Scribe', '[{"name": "Brief", "minutes": 3, "accepts_submission": false, "releases": []}, {"name": "Play", "minutes": 17, "accepts_submission": true, "releases": ["charades_target"]}, {"name": "Submit", "minutes": 5, "accepts_submission": true, "releases": []}]'::jsonb)
ON CONFLICT (slug) DO NOTHING;
