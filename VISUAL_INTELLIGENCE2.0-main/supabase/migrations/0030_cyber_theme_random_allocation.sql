-- ==============================================================================
-- VISUAL INTELLIGENCE 2.0: ROUND 1 CYBER THEMES SQL MIGRATION
-- Apply this in your Supabase Dashboard -> SQL Editor
-- Contains the exact 38 catalog themes, table schema, unique constraints, and RPCs.
-- ==============================================================================

begin;

-- 1. Theme Catalog Table
create table if not exists public.cyber_theme_catalog (
  theme_id text primary key,
  title text not null unique,
  description_line1 text not null,
  description_line2 text not null,
  instructions text not null,
  palette jsonb not null check (jsonb_typeof(palette) = 'array' and jsonb_array_length(palette) between 3 and 4),
  visual_style text not null unique,
  sort_order smallint not null unique check (sort_order between 1 and 38)
);

-- Seed the official 38 themes
insert into public.cyber_theme_catalog (theme_id, title, description_line1, description_line2, instructions, palette, visual_style, sort_order) values
  ('soft-girl-aesthetic', 'Soft Girl Aesthetic', 'Visual Style: Pastel shades, delicate floral elements, rounded cards, gentle typography, and dreamy Pinterest-inspired design.', 'What to Create: Style an airy pastel interface with pillowy rounded containers, delicate daisy/blush motifs, and soft dreamy gradients.', 'Create a soft, delicate pastel aesthetic with gentle curves, subtle floral accents, light airy cards, and Pinterest-inspired layout patterns.', '[{"name":"Petal Pink","hex":"#ffd1dc"},{"name":"Cloud White","hex":"#fff5f7"},{"name":"Baby Lavender","hex":"#e8d7ff"},{"name":"Soft Sage","hex":"#d8f3dc"}]'::jsonb, 'soft-girl', 1),
  ('cottagecore', 'Cottagecore', 'Visual Style: Countryside cottages, wildflowers, vintage textures, earthy natural tones, and cozy rustic layouts.', 'What to Create: Build a cozy woodland interface with earthy warm backgrounds, botanical illustrations, vintage paper cards, and floral badges.', 'Design a warm rustic aesthetic using antique paper tones, sage greens, wildflower motifs, and handcrafted countryside charm.', '[{"name":"Rustic Earth","hex":"#4a3b32"},{"name":"Wild Moss","hex":"#87986a"},{"name":"Vintage Cream","hex":"#fbf6ee"},{"name":"Sunlit Terracotta","hex":"#c97a56"}]'::jsonb, 'cottagecore', 2),
  ('dark-academia', 'Dark Academia', 'Visual Style: Old university libraries, antique leather-bound books, sophisticated serif typography, and rich scholarly colors.', 'What to Create: Craft an Oxford study room aesthetic with deep espresso backgrounds, gold gilded trims, wax-seal badges, and classic editorial typography.', 'Build a scholarly atmosphere with dark woods, aged parchment cards, rich gold highlights, and classic serif editorial hierarchy.', '[{"name":"Library Espresso","hex":"#1c140e"},{"name":"Antique Gold","hex":"#c89b3c"},{"name":"Oxblood Leather","hex":"#5c1d24"},{"name":"Aged Vellum","hex":"#eae0d0"}]'::jsonb, 'dark-academia', 3),
  ('dreamcore', 'Dreamcore', 'Visual Style: Surreal ethereal landscapes, floating geometric relics, uncanny nostalgic imagery, and dreamlike visual compositions.', 'What to Create: Construct an otherworldly interface featuring floating cloud platforms, twilight violet skies, subtle surrealist halos, and shimmering lucid cards.', 'Use surrealist dream gradients, floating ethereal cards, dream-logic composition, and liminal aesthetic visual effects.', '[{"name":"Lucid Sky","hex":"#1e1338"},{"name":"Dream Violet","hex":"#845ec2"},{"name":"Ethereal Mint","hex":"#b0f2b4"},{"name":"Twilight Mist","hex":"#fbeaff"}]'::jsonb, 'dreamcore', 4),
  ('japanese-zen-minimalism', 'Japanese Zen Minimalism', 'Visual Style: Generous clean spacing, natural shoji textures, balanced asymmetry, and quiet understated typography.', 'What to Create: Design a serene Zen sanctuary UI with tranquil negative space, washi-paper card borders, subtle bamboo inks, and calm balanced symmetry.', 'Implement extreme typographic discipline, vast tranquil whitespace, subtle ink-wash accents, and natural bamboo/stone tones.', '[{"name":"Sumi Ink","hex":"#191919"},{"name":"Washi Rice","hex":"#f7f5f0"},{"name":"Bamboo Green","hex":"#7a8b6e"},{"name":"Cinnabar Red","hex":"#b83b32"}]'::jsonb, 'zen-minimalism', 5),
  ('avengers-marvel-universe', 'Avengers / Marvel Universe', 'Visual Style: Superhero-inspired imagery, cinematic high-tech backdrops, bold heroic typography, and dramatic visual particle effects.', 'What to Create: Build an Avengers tactical mission terminal with vibrant Stark-tech HUD borders, vibranium shields, energy core glows, and cinematic heroism.', 'Create a heroic, action-oriented interface with bold dynamic slants, vibrant hero reds and arc-reactor cyans, and cinematic energy badges.', '[{"name":"Cinematic Dark","hex":"#0b0e14"},{"name":"Hero Crimson","hex":"#d32f2f"},{"name":"Arc Cyan","hex":"#00d2ff"},{"name":"Vibranium Gold","hex":"#fbc02d"}]'::jsonb, 'marvel', 6),
  ('harry-potter-wizarding-world', 'Harry Potter / Wizarding World', 'Visual Style: Enchanted gothic castles, arcane wizarding crests, spell-inspired glowing incantations, and mysterious candlelight illumination.', 'What to Create: Style a Hogwarts common room interface with magical floating candle glows, illuminated parchment scrolls, house-crest shields, and golden snitch sparks.', 'Craft a magical wizarding world theme featuring deep starry skies, enchanted gold filigree, parchment textures, and glowing spell incantations.', '[{"name":"Midnight Castle","hex":"#0e111a"},{"name":"Gryffindor Gold","hex":"#d4a34b"},{"name":"Enchanted Amber","hex":"#ff9100"},{"name":"Raven Mystery","hex":"#1e3a5f"}]'::jsonb, 'wizarding', 7),
  ('batman-gotham-city', 'Batman / Gotham City', 'Visual Style: Dark noir cityscapes, rain-drenched gothic silhouettes, dramatic high contrasts, and detective bat-computer forensics.', 'What to Create: Recreate Batman''s forensic bat-computer with noir monochrome panels, razor-sharp carbon trims, signal-lamp yellow highlights, and rain streaks.', 'Design an intense dark noir surveillance interface with matte graphite textures, razor-sharp edges, tactical carbon cards, and Gotham signal amber.', '[{"name":"Gotham Obsidian","hex":"#0a0a0c"},{"name":"Bat Signal Amber","hex":"#f5a623"},{"name":"Kevlar Charcoal","hex":"#22252a"},{"name":"Detective Silver","hex":"#8e99a4"}]'::jsonb, 'gotham', 8),
  ('spider-verse', 'Spider-Verse', 'Visual Style: Dynamic comic book panels, halftone screen dots, glitch chromatic aberration, and hyper-saturated urban pop colors.', 'What to Create: Overhaul the layout into a multiverse comic book with skewed panel angles, bright magenta/cyan spray-paint bursts, and pop halftone dots.', 'Use bold comic book halftone textures, chromatic RGB offset effects, skewed dynamic angles, and punchy neon comic color blocking.', '[{"name":"Brooklyn Void","hex":"#120a2a"},{"name":"Multiverse Pink","hex":"#ff007f"},{"name":"Webline Cyan","hex":"#00f0ff"},{"name":"Spray Yellow","hex":"#ffe600"}]'::jsonb, 'spiderverse', 9),
  ('star-wars-galaxy', 'Star Wars Galaxy', 'Visual Style: Galactic landscapes, starfighter cockpit HUDs, futuristic telemetry interfaces, and cinematic science-fiction visuals.', 'What to Create: Build a starfighter tactical console with Death Star trench schematics, illuminated hyperdrive jump buttons, and blue/red lightsaber energy bars.', 'Construct a cinematic sci-fi starship interface with cockpit instrument frames, Aurebesh-inspired typography, and kyber crystal energy lines.', '[{"name":"Deep Galaxy","hex":"#05070e"},{"name":"Kyber Blue","hex":"#29b6f6"},{"name":"Imperial Crimson","hex":"#e53935"},{"name":"Jedi Amber","hex":"#ffa000"}]'::jsonb, 'starwars', 10),
  ('minecraft-world', 'Minecraft World', 'Visual Style: Block-shaped elements, pixelated textures, cubic landscapes, and playful voxel game-inspired navigation.', 'What to Create: Convert the webpage into a Minecraft survival HUD with voxel stone containers, green grass block headers, redstone torches, and pixel font menus.', 'Adopt authentic 16-bit blocky aesthetics with beveled isometric borders, earthy stone/grass palettes, and retro pixelated typography.', '[{"name":"Bedrock Dark","hex":"#1e1e1e"},{"name":"Grass Top Green","hex":"#5b8731"},{"name":"Dirt Soil","hex":"#866043"},{"name":"Diamond Ore","hex":"#4dedf4"}]'::jsonb, 'minecraft', 11),
  ('super-mario-universe', 'Super Mario Universe', 'Visual Style: Cheerful platform game graphics, floating question blocks, golden coins, cartoon clouds, and high-energy Nintendo colors.', 'What to Create: Build a joyful Super Mario platformer world with bouncy question-mark reward buttons, green warp pipe dividers, and super-mushroom energy cards.', 'Create a playful, cheerful retro platformer aesthetic with bright primary colors, bouncy rounded buttons, and iconic coin/mushroom visual motifs.', '[{"name":"Sky Kingdom Blue","hex":"#5c94fc"},{"name":"Mario Red","hex":"#e52521"},{"name":"Question Block Gold","hex":"#fcd116"},{"name":"Warp Pipe Green","hex":"#00a800"}]'::jsonb, 'mario', 12),
  ('retro-arcade', 'Retro Arcade', 'Visual Style: Chunky pixel fonts, glowing CRT scanlines, retro high-score leaderboards, and nostalgic 1980s coin-op gaming visuals.', 'What to Create: Transform the page into an authentic 80s arcade cabinet marquee with coin-credit tickers, flashy flashing borders, and retro gaming buttons.', 'Design an intense 80s arcade cabinet experience featuring CRT scanline overlays, neon pixel typography, and high-score badge containers.', '[{"name":"Cabinet Black","hex":"#0c0817"},{"name":"Arcade Magenta","hex":"#ff1493"},{"name":"Vector Cyan","hex":"#00ffff"},{"name":"Insert Coin Gold","hex":"#ffd700"}]'::jsonb, 'arcade', 13),
  ('among-us-space-crew', 'Among Us / Space Crew', 'Visual Style: Cute cartoon spacesuits, modular spaceship bulkheads, starry airlock backgrounds, and playful emergency mystery elements.', 'What to Create: Design the Skeld spaceship emergency tablet with round astronaut glass visors, red emergency meeting alarms, and swipe-card security tasks.', 'Adopt a vibrant cartoon sci-fi aesthetic with rounded spacesuit visor shapes, bold comic outlines, and emergency alarm callouts.', '[{"name":"Space Void","hex":"#111428"},{"name":"Crewmate Cyan","hex":"#38fedc"},{"name":"Impostor Red","hex":"#c51111"},{"name":"Spaceship Gray","hex":"#71799e"}]'::jsonb, 'amongus', 14),
  ('roblox-universe', 'Roblox Universe', 'Visual Style: Vibrant 3D-inspired game environments, blocky avatar aesthetics, high-energy playful cards, and social metaverse styling.', 'What to Create: Build an interactive Roblox experience launcher with glossy chunky buttons, customizable avatar card slots, and playful experience badges.', 'Use bold rounded cards, vibrant punchy gaming colors, modern plastic textures, and playful metaverse dashboard navigation.', '[{"name":"Roblox Dark","hex":"#191b1d"},{"name":"Platform Red","hex":"#e2231a"},{"name":"Spark Blue","hex":"#00a2ff"},{"name":"Energy Lime","hex":"#00e676"}]'::jsonb, 'roblox', 15),
  ('medieval-kingdom', 'Medieval Kingdom', 'Visual Style: Ancient stone castles, weathered parchment textures, heraldic royal crests, and classic gothic fantasy typography.', 'What to Create: Rebuild the page into a royal kingdom proclamation scroll with stone masonry borders, gilded heraldic shields, and wax seal approval tags.', 'Craft an authentic medieval fantasy experience with aged parchment card backgrounds, iron rivets, royal banners, and gothic headers.', '[{"name":"Castle Slate","hex":"#1a1617"},{"name":"Royal Gold","hex":"#c59b27"},{"name":"Banner Crimson","hex":"#7a1c1c"},{"name":"Parchment Tan","hex":"#e9dac1"}]'::jsonb, 'medieval', 16),
  ('ancient-egypt', 'Ancient Egypt', 'Visual Style: Golden pharaonic pyramids, mystical hieroglyphics, lapis lazuli jewel accents, and ancient royal temple motifs.', 'What to Create: Style a golden tomb treasury with hieroglyphic stone tablet cards, deep lapis blue navigation bars, and gleaming sun-god gold borders.', 'Combine sand-textured stone backdrops with opulent royal golds, lapis lazuli blues, turquoise gems, and hieroglyphic glyph borders.', '[{"name":"Pharaoh Obsidian","hex":"#120f09"},{"name":"Tomb Gold","hex":"#e5a93c"},{"name":"Lapis Lazuli","hex":"#154388"},{"name":"Nile Turquoise","hex":"#2bb3ab"}]'::jsonb, 'egypt', 17),
  ('norse-mythology-vikings', 'Norse Mythology / Vikings', 'Visual Style: Viking longships, glowing elder runestones, frosty Nordic fjord landscapes, and legendary warrior imagery.', 'What to Create: Construct a Valhalla chieftain hall terminal with runic stone carvings, cold Nordic sea mist, weathered wood planks, and blazing hearth fire glow.', 'Design a fierce Viking aesthetic with weathered timber, carved stone runes, frosty fjord blues, and embers from a Nordic hearth.', '[{"name":"Fjord Abyss","hex":"#0e161c"},{"name":"Rune Frost Blue","hex":"#52b2cf"},{"name":"Viking Steel","hex":"#889ba8"},{"name":"Hearth Amber","hex":"#d97736"}]'::jsonb, 'vikings', 18),
  ('jurassic-park-adventure', 'Jurassic Park Adventure', 'Visual Style: Prehistoric dinosaur habitats, dense tropical rainforest jungles, high-voltage warning signs, and tactical amber park badges.', 'What to Create: Recreate the Isla Nublar park control terminal with high-voltage perimeter warnings, jungle camouflage cards, and amber mosquito fossil badges.', 'Build an exciting island safari security terminal with hazard yellow/red stripes, dense jungle greens, and dinosaur expedition badges.', '[{"name":"Jungle Shadow","hex":"#0d180f"},{"name":"Hazard Yellow","hex":"#ffd000"},{"name":"Amber Fossil","hex":"#d47500"},{"name":"Deep Canopy","hex":"#1d472b"}]'::jsonb, 'jurassic', 19),
  ('pirate-treasure-hunt', 'Pirate Treasure Hunt', 'Visual Style: Weathered sea charts, brass navigational compasses, sunken gold chests, and legendary nautical sailing ships.', 'What to Create: Transform the UI into a vintage treasure map with burned parchment edges, skull-and-crossbones compass roses, and doubloon gold buttons.', 'Use nautical antiquities, weathered map contours, brass compass rose decorations, doubloon gold highlights, and oceanic teakwood.', '[{"name":"Ocean Teak","hex":"#1c140c"},{"name":"Doubloon Gold","hex":"#d8a32a"},{"name":"Map Parchment","hex":"#e7ce9e"},{"name":"Sea Storm Blue","hex":"#1e374b"}]'::jsonb, 'pirate', 20),
  ('vogue-luxury-fashion-editorial', 'Vogue / Luxury Fashion Editorial', 'Visual Style: High-fashion editorial photography, sophisticated Didot serif typography, sleek magazine layouts, and haute-couture storytelling.', 'What to Create: Redesign the layout into a Parisian luxury fashion editorial with oversized elegant mastheads, razor-thin rule dividers, and monochrome runway poise.', 'Enforce supreme high-fashion editorial aesthetics: dramatic Didot serif headlines, generous architectural whitespace, and monochrome elegance.', '[{"name":"Atelier Black","hex":"#080808"},{"name":"Haute Cream","hex":"#f8f5f0"},{"name":"Champagne Gold","hex":"#d4af37"},{"name":"Editorial Gray","hex":"#737373"}]'::jsonb, 'vogue', 21),
  ('nike-sports-performance', 'Nike / Sports Performance', 'Visual Style: High-intensity athletic photography, oversized italic headlines, energetic kinetic compositions, and performance-driven visuals.', 'What to Create: Craft an adrenaline-fueled sports performance hub with bold slanted racing typography, electric volt-green highlights, and speed-streak dividers.', 'Create high-impact athletic energy using heavy slanted typography, aggressive high-contrast black/white, and electric volt neon accents.', '[{"name":"Pure Carbon","hex":"#111111"},{"name":"Volt Neon","hex":"#cefa05"},{"name":"Optic White","hex":"#ffffff"},{"name":"Velocity Orange","hex":"#ff5500"}]'::jsonb, 'nike', 22),
  ('spotify-music-universe', 'Spotify Music Universe', 'Visual Style: Vibrant vinyl album artwork, dark mode music discovery playlists, audio equalizer waves, and immersive sound visuals.', 'What to Create: Rebuild the webpage as a futuristic streaming audio deck with glowing Spotify-green play controls, blurred album backdrop halos, and waveform bars.', 'Adopt Spotify''s signature dark UI: deep matte black backgrounds, iconic Spotify green buttons, smooth playlist cards, and waveform accents.', '[{"name":"Spotify Pitch Black","hex":"#121212"},{"name":"Iconic Green","hex":"#1db954"},{"name":"Elevated Charcoal","hex":"#282828"},{"name":"Sonic White","hex":"#ffffff"}]'::jsonb, 'spotify', 23),
  ('nasa-space-exploration', 'NASA Space Exploration', 'Visual Style: High-resolution planetary imagery, mission control telemetry dashboards, spacecraft schematics, and clean scientific data panels.', 'What to Create: Build an Apollo/Artemis mission telemetry console with mission clock counters, orbital trajectory curves, clean scientific labels, and NASA blue badges.', 'Style a precise NASA aerospace control console with clean mission telemetry cards, technical badges, rocket schematics, and deep space navy.', '[{"name":"Cape Canaveral Navy","hex":"#0b1528"},{"name":"NASA Insignia Blue","hex":"#0b3d91"},{"name":"Mission Red","hex":"#fc3d21"},{"name":"Telemetry White","hex":"#f1f5f9"}]'::jsonb, 'nasa', 24),
  ('cozy-coffee-shop', 'Cozy Coffee Shop', 'Visual Style: Warm ambient lighting, rich roasted coffee tones, handcrafted blackboard menu cards, and a relaxed café atmosphere.', 'What to Create: Design an artisan coffee bar menu with warm mocha backgrounds, latte foam swirls, cinnamon gradient highlights, and chalkboard chalk badges.', 'Create an inviting, cozy atmosphere with warm espresso and caramel shades, soft rounded corners, blackboard cards, and warm café lighting.', '[{"name":"Roasted Espresso","hex":"#2b1810"},{"name":"Warm Caramel","hex":"#c48b52"},{"name":"Latte Cream","hex":"#f3e9dc"},{"name":"Cinnamon Amber","hex":"#8a4b27"}]'::jsonb, 'coffee', 25),
  ('enchanted-forest', 'Enchanted Forest', 'Visual Style: Bioluminescent flora, mossy woodland textures, misty twilight pathways, and magical fairy forest illumination.', 'What to Create: Style a mythical fairy woodland interface with glowing bioluminescent mushroom lamps, ethereal green moss containers, and shimmering spore particles.', 'Construct a glowing mythical forest aesthetic with deep evergreen shadows, luminous lime spore accents, and soft woodland mist.', '[{"name":"Deep Woodland","hex":"#07170e"},{"name":"Bioluminescent Lime","hex":"#39ff14"},{"name":"Misty Emerald","hex":"#1c6e43"},{"name":"Fairy Spore Gold","hex":"#e2e062"}]'::jsonb, 'enchanted-forest', 26),
  ('interstellar-travel', 'Interstellar Travel', 'Visual Style: Distant deep galaxies, hyperspace navigation coordinates, orbital planetary ellipses, and deep-space telescope imagery.', 'What to Create: Construct a warp-drive spaceship bridge with starlight speed-streak backdrops, orbital gravity well graphs, and sleek void glass panels.', 'Use deep space darks, glowing starlight points, orbital circular curves, and cyan/purple nebula gradients to simulate interstellar flight.', '[{"name":"Hyperspace Void","hex":"#040510"},{"name":"Pulsar Cyan","hex":"#48e5c2"},{"name":"Nebula Violet","hex":"#7f5af0"},{"name":"Starlight Silver","hex":"#e0e6ed"}]'::jsonb, 'interstellar', 27),
  ('wild-west', 'Wild West', 'Visual Style: Sun-scorched desert canyons, vintage wanted posters, weathered saloon timber, and rugged frontier slab-serif typography.', 'What to Create: Build an outlaw frontier saloon UI with aged wanted-poster cards, desert sand backgrounds, brass sheriff badge stars, and rugged wooden slats.', 'Adopt a rugged frontier aesthetic with sunbaked earth tones, weathered timber, wanted poster borders, and classic western slab typography.', '[{"name":"Saloon Timber","hex":"#2b1911"},{"name":"Desert Sand","hex":"#dfb15b"},{"name":"Canyon Rust","hex":"#9b3d12"},{"name":"Sheriff Brass","hex":"#e3ad38"}]'::jsonb, 'wild-west', 28),
  ('tropical-paradise', 'Tropical Paradise', 'Visual Style: Sunlit island scenery, lush palm foliage, sparkling turquoise water, and vibrant tropical resort travel layouts.', 'What to Create: Transform the page into a luxury island getaway with crystal-clear turquoise waters, hibiscus floral accents, and sunny resort card frames.', 'Design an invigorating tropical resort experience with turquoise lagoons, lush palm greens, sunset coral pinks, and breezy airy layouts.', '[{"name":"Lagoon Turquoise","hex":"#00b4d8"},{"name":"Palm Frond Green","hex":"#2d6a4f"},{"name":"Coral Sunset","hex":"#ff758f"},{"name":"Island Sand","hex":"#fff1e6"}]'::jsonb, 'tropical', 29),
  ('dreamy-lavender', 'Dreamy Lavender', 'Visual Style: Provence lavender fields, soft purple-to-pink gradients, delicate botanicals, and peaceful lilac-inspired visuals.', 'What to Create: Style a peaceful aromatherapy retreat portal with soft violet frosted glass, gentle lavender bud illustrations, and calm rounded cards.', 'Create a serene, calming aesthetic dominated by soft lilac and lavender shades, gentle glassmorphism, and tranquil typography.', '[{"name":"Deep Lavender","hex":"#2d1b4e"},{"name":"Lilac Bloom","hex":"#b5838d"},{"name":"Soft Lavender","hex":"#e2cfea"},{"name":"Mist Pearl","hex":"#f7f2f9"}]'::jsonb, 'lavender', 30),
  ('y2k-futurism', 'Y2K Futurism', 'Visual Style: Glossy chrome lettering, bubblegum inflatable surfaces, playful cyber icons, and nostalgic early-2000s digital optimism.', 'What to Create: Build an authentic year-2000 cyber-pop web portal with liquid metallic chrome badges, bubble-gum pink cards, and cute 2000s cyber sparkles.', 'Channel late 90s/early 2000s cyber-optimism with iridescent chrome gradients, bubble outlines, glossy pill buttons, and playful metallic sheen.', '[{"name":"Cyber Silver","hex":"#1a1c29"},{"name":"Chrome Mirror","hex":"#d0d7de"},{"name":"Bubblegum Pink","hex":"#ff66cc"},{"name":"Cyber Ice","hex":"#70d6ff"}]'::jsonb, 'y2k', 31),
  ('steampunk-invention', 'Steampunk Invention', 'Visual Style: Victorian brass machinery, interlocking clockwork gears, burnished copper textures, and industrial steam gauges.', 'What to Create: Construct a Victorian inventor workshop workbench with rotating brass cogwheel borders, analog pressure dials, and rivet-fastened bronze panels.', 'Design an elaborate Victorian industrial invention console featuring brushed brass, interlocking gears, copper rivets, and analog pressure gauges.', '[{"name":"Industrial Coal","hex":"#1b140e"},{"name":"Burnished Brass","hex":"#d49b3d"},{"name":"Steam Copper","hex":"#b85d19"},{"name":"Piston Iron","hex":"#5c504a"}]'::jsonb, 'steampunk', 32),
  ('haunted-mansion', 'Haunted Mansion', 'Visual Style: Gothic manor architecture, eerie candle shadows, swirling fog backgrounds, and mysterious spectral apparitions.', 'What to Create: Style a spooky haunted parlor with swirling graveyard mist, wrought-iron cobweb gates, ghostly phantom green glows, and gothic frames.', 'Create a chilling gothic horror environment with pitch-black shadows, eerie cemetery mist, spectral green glows, and weathered haunted architecture.', '[{"name":"Midnight Crypt","hex":"#0b0c10"},{"name":"Phantom Green","hex":"#66fcf1"},{"name":"Spectral Lilac","hex":"#a480cf"},{"name":"Gothic Cobweb","hex":"#45a29e"}]'::jsonb, 'haunted', 33),
  ('pop-art-comic-book', 'Pop Art Comic Book', 'Visual Style: Roy Lichtenstein speech bubbles, heavy Ben-Day dot patterns, oversized graphic sound effects, and explosive primary colors.', 'What to Create: Rebuild the webpage into an explosive Pop Art gallery with POW! speech bubble banners, thick black comic outlines, and bold primary color dots.', 'Adopt authentic Lichtenstein pop-art styling with thick black graphic contours, Ben-Day dot halftone fills, and screaming high-contrast primary colors.', '[{"name":"Ink Black","hex":"#000000"},{"name":"Pop Yellow","hex":"#ffe600"},{"name":"Action Red","hex":"#ff0033"},{"name":"Comic Cyan","hex":"#00b2fe"}]'::jsonb, 'pop-art', 34),
  ('iron-man-lab', 'Iron Man Lab', 'Visual Style: Holographic Jarvis schematics, Mark armour technical diagrams, hot-rod red and gold armor plating, and glowing arc reactor power cores.', 'What to Create: Design Tony Stark''s Malibu laboratory HUD with floating holographic armor blueprints, arc reactor power gauges, and hot-rod crimson plating.', 'Build an elite high-tech laboratory HUD with hot-rod red and gold accents, glowing arc reactor cyans, and floating technical wireframe diagnostics.', '[{"name":"Stark Armor Red","hex":"#8b0000"},{"name":"Hot Rod Gold","hex":"#ffcc00"},{"name":"Arc Core Cyan","hex":"#00f7ff"},{"name":"Titanium Chassis","hex":"#14171f"}]'::jsonb, 'iron-man', 35),
  ('k-pop-star', 'K-Pop Star', 'Visual Style: Stadium arena concert lighting, album photobook graphics, bold energetic typography, and sleek music video glamour.', 'What to Create: Create a dynamic K-Pop idol comeback launch page with sparkling stage spotlight glows, pastel neon gradients, and stylish photocard containers.', 'Design an electrifying K-Pop concert and photobook aesthetic with laser stage spotlights, sparkling neon gradients, and stylish modern typography.', '[{"name":"Stage Midnight","hex":"#110b22"},{"name":"Comeback Magenta","hex":"#ff2a85"},{"name":"Lightstick Cyan","hex":"#05d9e8"},{"name":"Glitz Purple","hex":"#7b2cbf"}]'::jsonb, 'k-pop', 36),
  ('formula-1-racing', 'Formula 1 Racing', 'Visual Style: High-speed Grand Prix racecars, telemetry track circuit graphics, aerodynamic carbon weaves, and high-octane motorsport branding.', 'What to Create: Construct a pit-wall telemetry timing board with live sector timing deltas, carbon-fiber textured cards, and checkered flag racing stripes.', 'Build a high-octane motorsport dashboard featuring racing red accents, carbon-fiber textures, speed-gauge deltas, and sharp aerodynamic cards.', '[{"name":"Tarmac Carbon","hex":"#121316"},{"name":"Scuderia Red","hex":"#e10600"},{"name":"Track Apex White","hex":"#ffffff"},{"name":"Sector Yellow","hex":"#ffeb3b"}]'::jsonb, 'f1', 37),
  ('football-champions', 'Football Champions', 'Visual Style: Floodlit championship stadiums, pristine pitch turf, team lineup cards, match scoreboards, and golden trophy prestige.', 'What to Create: Recreate a Champions League matchday dashboard with stadium night floodlight beams, pitch-grass green cards, and golden championship trophy badges.', 'Design a prestigious tournament arena aesthetic with stadium floodlights, emerald pitch turf colors, championship gold medals, and scoreboard cards.', '[{"name":"Stadium Night","hex":"#0a1118"},{"name":"Pitch Emerald","hex":"#1b8a43"},{"name":"Trophy Gold","hex":"#f4c430"},{"name":"Match Floodlight","hex":"#e0f2fe"}]'::jsonb, 'football', 38)
on conflict (theme_id) do update set
  title = excluded.title,
  description_line1 = excluded.description_line1,
  description_line2 = excluded.description_line2,
  instructions = excluded.instructions,
  palette = excluded.palette,
  visual_style = excluded.visual_style,
  sort_order = excluded.sort_order;

-- 2. Team Theme Assignments Table (Strictly 1:1, unique per team and unique per theme)
create table if not exists public.cyber_theme_assignments (
  team_id uuid primary key references public.teams(id) on delete cascade,
  theme_id text not null unique references public.cyber_theme_catalog(theme_id) on delete restrict,
  assigned_at timestamptz not null default now()
);

-- Row Level Security
alter table public.cyber_theme_catalog enable row level security;
alter table public.cyber_theme_assignments enable row level security;

-- Catalog is publicly readable
drop policy if exists "Allow read cyber_theme_catalog" on public.cyber_theme_catalog;
create policy "Allow read cyber_theme_catalog"
  on public.cyber_theme_catalog for select
  using (true);

-- Team assignments are protected: only admin or service role
drop policy if exists "Admin read cyber_theme_assignments" on public.cyber_theme_assignments;
create policy "Admin read cyber_theme_assignments"
  on public.cyber_theme_assignments for select
  using (is_admin());

drop policy if exists "Admin manage cyber_theme_assignments" on public.cyber_theme_assignments;
create policy "Admin manage cyber_theme_assignments"
  on public.cyber_theme_assignments for all
  using (is_admin());

-- 3. Atomic Single Team Theme Allocator (Zero repetition, concurrency safe via advisory lock)
create or replace function assign_team_cyber_theme(p_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing_theme_id text;
  v_theme cyber_theme_catalog;
  v_chosen_theme_id text;
begin
  if not exists (select 1 from teams where id = p_team_id) then
    raise exception 'Team not found' using errcode = 'VI001';
  end if;

  -- 1. Check if team already has an assignment
  select theme_id into v_existing_theme_id
  from cyber_theme_assignments
  where team_id = p_team_id;

  if v_existing_theme_id is not null then
    select * into v_theme from cyber_theme_catalog where theme_id = v_existing_theme_id;
    return jsonb_build_object(
      'theme_id', v_theme.theme_id,
      'title', v_theme.title,
      'description_line1', v_theme.description_line1,
      'description_line2', v_theme.description_line2,
      'instructions', v_theme.instructions,
      'palette', v_theme.palette,
      'visual_style', v_theme.visual_style
    );
  end if;

  -- 2. Concurrency lock to prevent race conditions across parallel requests
  perform pg_advisory_xact_lock(hashtext('cyber_theme_allocation')::bigint);

  -- Recheck after acquiring transaction lock
  select theme_id into v_existing_theme_id
  from cyber_theme_assignments
  where team_id = p_team_id;

  if v_existing_theme_id is not null then
    select * into v_theme from cyber_theme_catalog where theme_id = v_existing_theme_id;
    return jsonb_build_object(
      'theme_id', v_theme.theme_id,
      'title', v_theme.title,
      'description_line1', v_theme.description_line1,
      'description_line2', v_theme.description_line2,
      'instructions', v_theme.instructions,
      'palette', v_theme.palette,
      'visual_style', v_theme.visual_style
    );
  end if;

  -- 3. Select an unused theme randomly (Zero repetition)
  select theme_id into v_chosen_theme_id
  from cyber_theme_catalog
  where theme_id not in (select theme_id from cyber_theme_assignments)
  order by gen_random_uuid()
  limit 1;

  if v_chosen_theme_id is null then
    raise exception 'All 38 themes have already been allocated' using errcode = 'VI001';
  end if;

  -- 4. Store assignment persistently
  insert into cyber_theme_assignments (team_id, theme_id, assigned_at)
  values (p_team_id, v_chosen_theme_id, now())
  on conflict (team_id) do nothing;

  select * into v_theme from cyber_theme_catalog where theme_id = v_chosen_theme_id;
  return jsonb_build_object(
    'theme_id', v_theme.theme_id,
    'title', v_theme.title,
    'description_line1', v_theme.description_line1,
    'description_line2', v_theme.description_line2,
    'instructions', v_theme.instructions,
    'palette', v_theme.palette,
    'visual_style', v_theme.visual_style
  );
end;
$$;

-- 4. Participant RPC: Authenticated team theme lookup
create or replace function get_my_team_cyber_theme(p_code text, p_reg_no text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team_id uuid;
  v_team_name text;
  v_theme jsonb;
begin
  select t.id, t.name into v_team_id, v_team_name
  from teams t
  where normalize_team_code(t.code) = normalize_team_code(p_code);

  if v_team_id is null then
    raise exception 'Invalid team code' using errcode = 'VI001';
  end if;

  if not exists (select 1 from members where team_id = v_team_id and reg_no = p_reg_no) then
    raise exception 'Member not found in team' using errcode = 'VI001';
  end if;

  v_theme := assign_team_cyber_theme(v_team_id);

  return jsonb_build_object(
    'team_id', v_team_id,
    'team_name', v_team_name,
    'theme', v_theme
  );
end;
$$;

-- 5. Admin RPC: Get all team assignments and remaining count
create or replace function admin_get_cyber_theme_allocations()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total_teams int;
  v_assigned_teams int;
  v_stage1_status text;
  v_allocations jsonb;
  v_themes jsonb;
begin
  if not is_admin() then
    raise exception 'Admin access required' using errcode = 'VI010';
  end if;

  select count(*) into v_total_teams from teams;
  select count(*) into v_assigned_teams from cyber_theme_assignments;
  select status into v_stage1_status from stage_progress where stage = 1;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'team_id', t.id,
      'team_name', t.name,
      'team_code', t.code,
      'team_status', t.status,
      'theme_id', c.theme_id,
      'theme_title', c.title,
      'description_line1', c.description_line1,
      'description_line2', c.description_line2,
      'visual_style', c.visual_style,
      'palette', c.palette,
      'assigned_at', a.assigned_at
    ) order by t.name
  ), '[]'::jsonb) into v_allocations
  from teams t
  left join cyber_theme_assignments a on a.team_id = t.id
  left join cyber_theme_catalog c on c.theme_id = a.theme_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'theme_id', theme_id,
      'title', title,
      'description_line1', description_line1,
      'description_line2', description_line2,
      'instructions', instructions,
      'palette', palette,
      'visual_style', visual_style,
      'sort_order', sort_order
    ) order by sort_order
  ), '[]'::jsonb) into v_themes
  from cyber_theme_catalog;

  return jsonb_build_object(
    'total_teams', v_total_teams,
    'assigned_teams', v_assigned_teams,
    'unassigned_teams', greatest(0, v_total_teams - v_assigned_teams),
    'total_catalogue_themes', 38,
    'available_themes', greatest(0, 38 - v_assigned_teams),
    'round1_status', coalesce(v_stage1_status, 'not_released'),
    'can_reassign', coalesce(v_stage1_status, 'not_released') not in ('live', 'ended'),
    'allocations', v_allocations,
    'themes', v_themes
  );
end;
$$;

-- 6. Admin RPC: Bulk allocate unassigned teams (Zero repetition)
create or replace function admin_allocate_all_cyber_themes(p_reassign boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stage1_status text;
  v_team record;
  v_assigned_count int := 0;
begin
  if not is_admin() then
    raise exception 'Admin access required' using errcode = 'VI010';
  end if;

  select status into v_stage1_status from stage_progress where stage = 1;

  if p_reassign and v_stage1_status in ('live', 'ended') then
    raise exception 'Cannot reassign themes after Round 1 has started or ended' using errcode = 'VI001';
  end if;

  perform pg_advisory_xact_lock(hashtext('cyber_theme_allocation')::bigint);

  if p_reassign then
    delete from cyber_theme_assignments;
  end if;

  for v_team in
    select id from teams
    where id not in (select team_id from cyber_theme_assignments)
    order by random()
  loop
    -- Stop if all 38 themes are consumed
    if (select count(*) from cyber_theme_assignments) >= 38 then
      exit;
    end if;

    perform assign_team_cyber_theme(v_team.id);
    v_assigned_count := v_assigned_count + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'allocated_count', v_assigned_count,
    'reassigned', p_reassign
  );
end;
$$;

grant execute on function get_my_team_cyber_theme(text, text) to anon, authenticated;
grant execute on function assign_team_cyber_theme(uuid) to anon, authenticated;
grant execute on function admin_get_cyber_theme_allocations() to authenticated;
grant execute on function admin_allocate_all_cyber_themes(boolean) to authenticated;

commit;
