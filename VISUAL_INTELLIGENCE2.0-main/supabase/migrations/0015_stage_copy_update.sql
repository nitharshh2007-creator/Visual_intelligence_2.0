-- ─────────────────────────────────────────────────────────────
-- Migration 0015: Official activity copy for the 4 stages
-- ─────────────────────────────────────────────────────────────
-- Builds on 0001-0014 (not edited). Updates hook/tests/duration_min
-- on the 4 existing stage rows (seeded in 0004) to match the
-- organizers' official "Visual Intelligence 2.0 — Activities" copy
-- exactly. No structural change — same 4 stages, same slugs/numbers,
-- same admin flow (release -> start -> end per stage, unchanged by
-- this migration). The separately-listed "GenAI Intro" (10 min) is
-- explicitly NOT one of the 4 stages per that copy — not added here;
-- it reads as a pre-event briefing outside this app's 4-stage model.

update stages set
  hook = 'Same HTML file, different themes. Teams use GenAI to redesign it.',
  tests = array['Prompting', 'coding', 'creativity'],
  duration_min = 25
where slug = 'cyber-styling';

update stages set
  hook = 'Teams solve a bug/clue hidden across 10 files → password → PDF → Google Form.',
  tests = array['Debugging', 'logic', 'AI problem-solving'],
  duration_min = 30
where slug = 'bugx-hacker';

update stages set
  hook = '10 images + 10 words → create a 30-sec AI advertisement in 20 min.',
  tests = array['Prompting', 'creativity', 'multimodal AI'],
  duration_min = 40
where slug = 'prompt-rumble';

update stages set
  hook = 'One member can''t see the image. Team describes/acts it → they generate it using AI.',
  tests = array['Communication', 'visual understanding', 'prompting'],
  duration_min = 25
where slug = 'prompt-charades';
