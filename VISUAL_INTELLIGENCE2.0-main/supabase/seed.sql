-- ─────────────────────────────────────────────────────────────
-- TEST DATA — 12 teams, 4 members each, Stage 1–2 scores.
-- ─────────────────────────────────────────────────────────────
-- Safe to run against a fresh project after 0001 + 0002. Every row
-- is tagged so reset_test_data.sql can remove exactly this data and
-- nothing else: team names are prefixed "TEST " and member reg_nos
-- are prefixed "TEST-".
--
-- Run: psql "$DATABASE_URL" -f supabase/seed.sql
-- (or paste into the Supabase SQL editor).

do $$
declare
  v_team_id uuid;
  v_names text[] := array[
    'TEST Team Nova', 'TEST Cyber Knights', 'TEST Prompt Engineers', 'TEST AI Wizards',
    'TEST The Alchemists', 'TEST Neural Nexus', 'TEST Quantum Leap', 'TEST Byte Force',
    'TEST Code Crusaders', 'TEST Synapse Squad', 'TEST Pixel Pirates', 'TEST Matrix Minds'
  ];
  v_members text[][] := array[
    array['Aarav S.','Diya M.','Rohan K.','Ishita P.'],
    array['Ishaan P.','Ananya R.','Kabir T.','Myra S.'],
    array['Meera V.','Arjun D.','Priya N.','Kian B.'],
    array['Siddharth L.','Kavya G.','Neel B.','Trisha R.'],
    array['Tanya J.','Rishi A.','Sara W.','Dhruv P.'],
    array['Vikram H.','Aisha F.','Dev C.','Navya K.'],
    array['Shreya I.','Aditya K.','Neha S.','Rian D.'],
    array['Karthik R.','Zara P.','Manav T.','Avni J.'],
    array['Rhea M.','Arnav S.','Pooja L.','Vihaan C.'],
    array['Vivaan D.','Nisha B.','Jai V.','Saanvi H.'],
    array['Aanya G.','Sahil N.','Tanvi R.','Om S.'],
    array['Harsh J.','Simran K.','Akash P.','Riya T.']
  ];
  i int;
  j int;
  v_code text;
begin
  for i in 1..array_length(v_names, 1) loop
    v_code := 'DUM-T' || lpad(i::text, 3, '0');

    insert into teams (name, code, status)
    values (v_names[i], v_code, 'incomplete')
    returning id into v_team_id;

    for j in 1..4 loop
      exit when v_members[i][j] is null;
      insert into members (team_id, name, reg_no, email, role)
      values (
        v_team_id,
        v_members[i][j],
        'TEST-' || i || '-' || j,
        'test-' || i || '-' || j || '@example.com',
        case when j = 1 then 'captain' else 'member' end
      );
    end loop;

    update teams set captain_id = (
      select id from members where team_id = v_team_id and role = 'captain'
    ) where id = v_team_id;

    -- Stage 1 + 2 scores, Stage 3/4 left unset (pending).
    insert into scores (team_id, stage, points) values
      (v_team_id, 1, 55 + (random() * 40)::int),
      (v_team_id, 2, 50 + (random() * 40)::int);
  end loop;
end $$;

-- Event state: stage 2 finished, stage 3 live (matches the mock's
-- default currentStage=3 in src/hooks/useLeaderboard.ts).
update event_state set
  status = 'live',
  current_stage = 3,
  stage_started_at = now(),
  stage_ends_at = now() + interval '15 minutes',
  updated_at = now()
where id = 1;

-- Clean up any existing admin user just in case
delete from auth.users where email = 'admin88@admin.com';

-- Seed an admin user (email: admin88@admin.com, password: Admin0)
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, 
  email_confirmed_at, recovery_sent_at, last_sign_in_at, 
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000088', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
  'admin88@admin.com', crypt('Admin0', gen_salt('bf')), 
  now(), now(), now(), 
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), 
  '', '', '', ''
);

insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) values (
    '00000000-0000-0000-0000-000000000088', '00000000-0000-0000-0000-000000000088', 
    format('{"sub":"%s","email":"%s"}', '00000000-0000-0000-0000-000000000088', 'admin88@admin.com')::jsonb, 
    'email', '00000000-0000-0000-0000-000000000088', now(), now(), now()
);

insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000088');
