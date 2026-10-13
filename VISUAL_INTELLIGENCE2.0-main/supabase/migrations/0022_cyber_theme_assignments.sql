-- Persist the official Cyber Styling UI theme catalog and randomized team
-- assignments. Eligible teams use the existing event rule: status ready/full.

create table if not exists cyber_theme_catalog (
  theme_id text primary key,
  title text not null unique,
  instructions text not null,
  palette jsonb not null check (jsonb_typeof(palette) = 'array' and jsonb_array_length(palette) between 3 and 4),
  visual_style text not null unique,
  sort_order smallint not null unique check (sort_order between 1 and 38)
);

insert into cyber_theme_catalog (theme_id, title, instructions, palette, visual_style, sort_order) values
  ('neon-rush', 'Neon Rush', 'Create a dark interface with glowing cyan and pink accents, luminous borders, bold headings, and subtle neon effects on buttons and cards.', '[{"name":"Void","hex":"#090b18"},{"name":"Cyan","hex":"#00e5ff"},{"name":"Hot pink","hex":"#ff3f9f"}]', 'neon', 1),
  ('matrix-mode', 'Matrix Mode', 'Build a green-on-black interface inspired by digital code, using monospace typography, code-like backgrounds, and clean terminal-inspired panels.', '[{"name":"Black","hex":"#050807"},{"name":"Matrix green","hex":"#55ff78"},{"name":"Terminal mint","hex":"#b5ffc2"}]', 'matrix', 2),
  ('glitch-zone', 'Glitch Zone', 'Use distorted typography, RGB split effects, offset outlines, and controlled glitch animations to create a digital-error aesthetic without affecting readability.', '[{"name":"Near black","hex":"#0b0b12"},{"name":"Glitch cyan","hex":"#00eaff"},{"name":"Glitch red","hex":"#ff365e"}]', 'glitch', 3),
  ('glasswave', 'Glasswave', 'Design a modern glassmorphism interface with translucent cards, blurred backgrounds, soft gradients, and subtle borders that create depth.', '[{"name":"Midnight","hex":"#11152a"},{"name":"Wave blue","hex":"#70c9ff"},{"name":"Lilac haze","hex":"#b8a4ff"}]', 'glass', 4),
  ('pixel-quest', 'Pixel Quest', 'Use pixel-inspired fonts, block-shaped cards, sharp edges, and simple 8-bit decorative elements inspired by classic games.', '[{"name":"Pixel ink","hex":"#17152b"},{"name":"Coin gold","hex":"#ffd447"},{"name":"Pixel mint","hex":"#69efaa"}]', 'pixel', 5),
  ('arcade-pulse', 'Arcade Pulse', 'Create a vibrant arcade-style interface with bold scoreboards, bright outlines, chunky buttons, and high-contrast game-inspired panels.', '[{"name":"Arcade navy","hex":"#11143b"},{"name":"Arcade pink","hex":"#ff47c8"},{"name":"Arcade blue","hex":"#40cfff"}]', 'arcade', 6),
  ('cyber-tokyo', 'Cyber Tokyo', 'Use a dark urban-inspired interface with vertical text accents, neon sign-like headings, compact panels, and pink, cyan, and red highlights.', '[{"name":"Night city","hex":"#0c101b"},{"name":"Sign pink","hex":"#ff4a9e"},{"name":"Sign cyan","hex":"#30e7ed"},{"name":"Signal red","hex":"#ff514f"}]', 'tokyo', 7),
  ('purple-protocol', 'Purple Protocol', 'Build a polished interface dominated by violet and purple gradients, layered surfaces, glowing accents, and elegant rounded cards.', '[{"name":"Deep violet","hex":"#21113e"},{"name":"Protocol purple","hex":"#9564ff"},{"name":"Soft lilac","hex":"#d5bcff"}]', 'purple', 8),
  ('chrome-shift', 'Chrome Shift', 'Create a metallic UI with silver gradients, reflective-looking surfaces, sharp edges, and restrained highlights that suggest polished chrome.', '[{"name":"Graphite","hex":"#171b22"},{"name":"Chrome","hex":"#d6e0e8"},{"name":"Steel blue","hex":"#7893a8"}]', 'chrome', 9),
  ('liquid-motion', 'Liquid Motion', 'Use fluid gradient backgrounds, flowing organic shapes, soft rounded cards, and subtle transitions to create a smooth, liquid-inspired interface.', '[{"name":"Deep aqua","hex":"#073940"},{"name":"Liquid teal","hex":"#36dbc2"},{"name":"Flow blue","hex":"#648bff"}]', 'liquid', 10),
  ('terminal-x', 'Terminal X', 'Design a command-line-inspired UI using monospace fonts, structured text panels, terminal prompts, and minimal green or amber accents.', '[{"name":"Console black","hex":"#090a08"},{"name":"Prompt green","hex":"#9df56c"},{"name":"Amber","hex":"#ffbd59"}]', 'terminal', 11),
  ('laser-grid', 'Laser Grid', 'Use perspective grids, glowing lines, geometric alignment, and dark backgrounds to create a laser-lit futuristic interface.', '[{"name":"Grid black","hex":"#090817"},{"name":"Laser cyan","hex":"#32e8ff"},{"name":"Laser violet","hex":"#b14cff"}]', 'laser', 12),
  ('cosmic-drift', 'Cosmic Drift', 'Create a space-inspired UI with star patterns, deep gradients, orbital decorations, and colorful cosmic accents against a dark background.', '[{"name":"Cosmic navy","hex":"#0c1230"},{"name":"Nebula pink","hex":"#f06bbd"},{"name":"Comet blue","hex":"#64b8ff"}]', 'cosmic', 13),
  ('aurora-flow', 'Aurora Flow', 'Use layered northern-lights-inspired gradients, soft color transitions, translucent panels, and smooth visual blending.', '[{"name":"Polar night","hex":"#101b31"},{"name":"Aurora green","hex":"#7cf2c2"},{"name":"Aurora violet","hex":"#a68aff"}]', 'aurora', 14),
  ('red-alert', 'Red Alert', 'Build a high-contrast dark interface with red warning labels, strong dividers, bold status indicators, and carefully placed alert-style highlights.', '[{"name":"Alert black","hex":"#110d12"},{"name":"Warning red","hex":"#ff3d4f"},{"name":"Signal amber","hex":"#ffba55"}]', 'alert', 15),
  ('toxic-byte', 'Toxic Byte', 'Use acid green, black, angular cards, sharp geometric details, and high-contrast borders to create an edgy digital interface.', '[{"name":"Carbon","hex":"#10120d"},{"name":"Toxic lime","hex":"#c8ff28"},{"name":"Acid green","hex":"#56ef67"}]', 'toxic', 16),
  ('mono-core', 'Mono Core', 'Design a minimal black-and-white interface with strong typography, generous whitespace, simple geometric shapes, and no unnecessary decoration.', '[{"name":"Black","hex":"#101010"},{"name":"White","hex":"#f2f2f2"},{"name":"Gray","hex":"#858585"}]', 'mono', 17),
  ('retro-wave', 'Retro Wave', 'Combine sunset gradients, geometric mountains, retro typography, and grid patterns to recreate a classic synthwave-inspired interface.', '[{"name":"Night purple","hex":"#20104a"},{"name":"Sunset coral","hex":"#ff6b83"},{"name":"Retro orange","hex":"#ffb44c"}]', 'retrowave', 18),
  ('blueprint-x', 'Blueprint X', 'Use technical grid backgrounds, annotation-style labels, thin blue lines, measurement-inspired details, and structured engineering-style panels.', '[{"name":"Blueprint navy","hex":"#082443"},{"name":"Draft blue","hex":"#65b8ff"},{"name":"Paper white","hex":"#e3f2ff"}]', 'blueprint', 19),
  ('holo-deck', 'Holo Deck', 'Build a futuristic HUD-style interface using transparent panels, layered outlines, compact status labels, and cyan holographic accents.', '[{"name":"HUD black","hex":"#07141b"},{"name":"Hologram cyan","hex":"#69f4ff"},{"name":"Interface blue","hex":"#6397ff"}]', 'hud', 20),
  ('deep-space', 'Deep Space', 'Use deep navy and black backgrounds, subtle stars, orbital graphics, and restrained blue highlights to create a spacious space-inspired design.', '[{"name":"Space black","hex":"#050914"},{"name":"Deep navy","hex":"#101d42"},{"name":"Star blue","hex":"#78aaff"}]', 'deepspace', 21),
  ('cyber-frost', 'Cyber Frost', 'Create an icy interface with pale blue highlights, frosted surfaces, cool gradients, translucent cards, and crisp white typography.', '[{"name":"Frost white","hex":"#eaf7ff"},{"name":"Ice blue","hex":"#91dcff"},{"name":"Glacier","hex":"#6388c4"}]', 'frost', 22),
  ('solar-flare', 'Solar Flare', 'Use warm orange, amber, and yellow gradients, radiant highlights, bold headings, and rounded surfaces inspired by sunlight and energy.', '[{"name":"Solar amber","hex":"#ffb52f"},{"name":"Flare orange","hex":"#ff633f"},{"name":"Warm cream","hex":"#fff1b5"}]', 'solar', 23),
  ('circuit-breaker', 'Circuit Breaker', 'Incorporate circuit-board patterns, connected traces, node-like details, and green or cyan accents around clean technical cards.', '[{"name":"Board green","hex":"#071a17"},{"name":"Trace mint","hex":"#4cf0ae"},{"name":"Circuit cyan","hex":"#45d9ed"}]', 'circuit', 24),
  ('data-storm', 'Data Storm', 'Design a data-dashboard-inspired interface with compact information cards, structured data blocks, charts or chart placeholders, and dynamic visual accents.', '[{"name":"Dashboard navy","hex":"#101a34"},{"name":"Data cyan","hex":"#42d9ec"},{"name":"Metric violet","hex":"#9c79ff"}]', 'dashboard', 25),
  ('quantum-fold', 'Quantum Fold', 'Use layered geometric planes, folded shapes, overlapping panels, and contrasting gradients to create a dimensional geometric interface.', '[{"name":"Fold indigo","hex":"#211b52"},{"name":"Quantum pink","hex":"#f36fbe"},{"name":"Plane blue","hex":"#6dc9ff"}]', 'fold', 26),
  ('digital-bloom', 'Digital Bloom', 'Combine glowing floral geometry, petal-like shapes, soft gradients, and organic decorative patterns with a clean modern layout.', '[{"name":"Bloom plum","hex":"#261632"},{"name":"Petal pink","hex":"#fa83c7"},{"name":"Stem mint","hex":"#78e7ad"}]', 'bloom', 27),
  ('wireframe-world', 'Wireframe World', 'Use wireframe grids, outlined geometric objects, perspective lines, and minimal dark surfaces to create a 3D-wireframe-inspired appearance.', '[{"name":"Wire black","hex":"#090f18"},{"name":"Wire cyan","hex":"#55eaff"},{"name":"Wire violet","hex":"#9675ff"}]', 'wireframe', 28),
  ('signal-lost', 'Signal Lost', 'Create a digital transmission-error aesthetic with subtle static textures, interrupted lines, signal indicators, and carefully placed warning symbols.', '[{"name":"Static charcoal","hex":"#15151a"},{"name":"Lost red","hex":"#ff5757"},{"name":"Noise mint","hex":"#a6f5cc"}]', 'signal', 29),
  ('shadow-ops', 'Shadow Ops', 'Build a stealth-inspired dark interface using charcoal and muted gray surfaces, restrained highlights, compact cards, and sharp, understated typography.', '[{"name":"Shadow black","hex":"#101216"},{"name":"Ops gray","hex":"#6f7882"},{"name":"Muted silver","hex":"#c1c7ce"}]', 'shadow', 30),
  ('prism-break', 'Prism Break', 'Use angular shapes, prismatic color transitions, rainbow gradient accents, and clean contrasting panels to create a vivid refracted-light aesthetic.', '[{"name":"Prism dark","hex":"#131323"},{"name":"Spectrum pink","hex":"#ff6fb0"},{"name":"Spectrum cyan","hex":"#5ae4ff"},{"name":"Spectrum gold","hex":"#ffe16b"}]', 'prism', 31),
  ('neural-nexus', 'Neural Nexus', 'Design a network-inspired interface with connected nodes, branching lines, subtle glowing points, and structured panels representing interconnected information.', '[{"name":"Neural navy","hex":"#0d1730"},{"name":"Node cyan","hex":"#58e2ec"},{"name":"Synapse violet","hex":"#9e83ff"}]', 'neural', 32),
  ('synth-circuit', 'Synth Circuit', 'Combine retro-futuristic panels, electronic circuit motifs, bold typography, and controlled neon accents for a distinct synthesized-tech appearance.', '[{"name":"Synth purple","hex":"#251243"},{"name":"Circuit teal","hex":"#34e2c2"},{"name":"Pulse magenta","hex":"#f65db9"}]', 'synth', 33),
  ('magnetic', 'Magnetic', 'Create a typography-led interface with oversized headings, strong visual hierarchy, bold buttons, asymmetrical layouts, and large graphic elements.', '[{"name":"Magnetic ink","hex":"#14151c"},{"name":"Pull orange","hex":"#ff734d"},{"name":"Attract cream","hex":"#f0e9d8"}]', 'magnetic', 34),
  ('orbit-shift', 'Orbit Shift', 'Use circular layouts, orbit paths, concentric rings, and rounded panels to create a space-inspired interface organized around a central visual focus.', '[{"name":"Orbit navy","hex":"#0d1530"},{"name":"Ring blue","hex":"#69c8ff"},{"name":"Satellite lilac","hex":"#b39aff"}]', 'orbit', 35),
  ('infrared', 'Infrared', 'Build a dark interface with red, orange, and thermal-style gradients, heat-map-inspired accents, and high-contrast status panels.', '[{"name":"Thermal black","hex":"#170d11"},{"name":"Heat red","hex":"#ff3e35"},{"name":"Thermal orange","hex":"#ff9a38"},{"name":"Hot yellow","hex":"#ffe36a"}]', 'infrared', 36),
  ('cyber-carnival', 'Cyber Carnival', 'Create a playful but polished digital interface with vivid multicolor gradients, expressive shapes, bold cards, and lively accent combinations.', '[{"name":"Carnival violet","hex":"#5736bb"},{"name":"Carnival pink","hex":"#ff65ae"},{"name":"Carnival lime","hex":"#c7f45b"},{"name":"Carnival aqua","hex":"#52dfdc"}]', 'carnival', 37),
  ('void-interface', 'Void Interface', 'Design a minimal near-black interface with sparse luminous details, subtle outlines, restrained typography, and generous negative space.', '[{"name":"Void black","hex":"#050607"},{"name":"Dim silver","hex":"#626b73"},{"name":"Lone signal","hex":"#8eeaff"}]', 'void', 38)
on conflict (theme_id) do nothing;

create table if not exists cyber_theme_assignments (
  team_id uuid primary key references teams(id) on delete restrict,
  theme_id text not null unique references cyber_theme_catalog(theme_id) on delete restrict,
  assigned_at timestamptz not null default now()
);

create table if not exists cyber_theme_assignment_state (
  id integer primary key default 1 check (id = 1),
  assignment_version integer not null default 0 check (assignment_version >= 0),
  updated_at timestamptz not null default now()
);
insert into cyber_theme_assignment_state (id) values (1) on conflict (id) do nothing;

alter table cyber_theme_catalog enable row level security;
alter table cyber_theme_assignments enable row level security;
alter table cyber_theme_assignment_state enable row level security;
revoke all on cyber_theme_catalog, cyber_theme_assignments, cyber_theme_assignment_state from anon, authenticated;

create or replace function get_cyber_theme_assignments()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'registered_count', (select count(*) from teams),
    'eligible_count', (select count(*) from teams where status in ('ready', 'full')),
    'assigned_count', (select count(*) from cyber_theme_assignments),
    'eligible_assigned_count', (select count(*) from cyber_theme_assignments a join teams t on t.id = a.team_id where t.status in ('ready', 'full')),
    'assignment_version', (select assignment_version from cyber_theme_assignment_state where id = 1),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_id', t.id,
        'team_name', t.name,
        'assignment', case when c.theme_id is null then null else jsonb_build_object(
          'theme_id', c.theme_id,
          'theme_title', c.title,
          'instructions', c.instructions,
          'palette', c.palette,
          'visual_style', c.visual_style
        ) end
      ) order by t.name)
      from teams t
      left join cyber_theme_assignments a on a.team_id = t.id
      left join cyber_theme_catalog c on c.theme_id = a.theme_id
      where t.status in ('ready', 'full')
    ), '[]'::jsonb),
    'themes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'theme_id', theme_id,
        'theme_title', title,
        'instructions', instructions,
        'palette', palette,
        'visual_style', visual_style
      ) order by sort_order)
      from cyber_theme_catalog
    ), '[]'::jsonb)
  );
$$;

revoke all on function get_cyber_theme_assignments() from public;
grant execute on function get_cyber_theme_assignments() to anon, authenticated;

create or replace function admin_assign_cyber_themes(
  p_reassign boolean default false,
  p_expected_version integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eligible_count integer;
  v_assigned_count integer;
  v_current_version integer;
begin
  if not is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  -- Serialize assignment requests and prevent team-status changes during assignment.
  perform pg_advisory_xact_lock(hashtext('cyber_theme_assignments')::bigint);
  lock table teams in share row exclusive mode;
  select assignment_version into v_current_version
  from cyber_theme_assignment_state
  where id = 1
  for update;

  if p_expected_version is distinct from v_current_version then
    raise exception 'Theme assignments changed in another admin session. Reload before trying again.'
      using errcode = '40001';
  end if;

  select count(*) into v_eligible_count from teams where status in ('ready', 'full');
  if v_eligible_count <> 38 then
    raise exception 'Exactly 38 eligible teams are required; found % (registered teams: %)',
      v_eligible_count, (select count(*) from teams)
      using errcode = 'P0001';
  end if;

  select count(*) into v_assigned_count from cyber_theme_assignments;

  if v_assigned_count > 0 and not p_reassign then
    raise exception 'Themes are already assigned. Confirm an explicit reassignment to replace them.'
      using errcode = 'P0001';
  end if;

  if (select count(*) from cyber_theme_catalog) <> 38 then
    raise exception 'The official catalog must contain exactly 38 themes' using errcode = 'P0001';
  end if;

  if p_reassign then
    delete from cyber_theme_assignments;
  end if;

  with randomized_teams as (
    select id, row_number() over (order by gen_random_uuid()) as assignment_order
    from teams
    where status in ('ready', 'full')
  ),
  randomized_themes as (
    select theme_id, row_number() over (order by gen_random_uuid()) as assignment_order
    from cyber_theme_catalog
  )
  insert into cyber_theme_assignments (team_id, theme_id)
  select t.id, c.theme_id
  from randomized_teams t
  join randomized_themes c using (assignment_order);

  update cyber_theme_assignment_state
  set assignment_version = assignment_version + 1, updated_at = now()
  where id = 1
  returning assignment_version into v_current_version;

  return jsonb_build_object(
    'ok', true,
    'assigned_count', 38,
    'reassigned', p_reassign,
    'assignment_version', v_current_version
  );
end;
$$;

revoke all on function admin_assign_cyber_themes(boolean, integer) from public, anon;
grant execute on function admin_assign_cyber_themes(boolean, integer) to authenticated;
