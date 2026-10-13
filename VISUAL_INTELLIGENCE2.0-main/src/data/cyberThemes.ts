export interface CyberThemePaletteColor {
  name: string;
  hex: string;
}

export interface CyberTheme {
  theme_id: string;
  title: string;
  description_line1: string;
  description_line2: string;
  instructions: string;
  palette: CyberThemePaletteColor[];
  visual_style: string;
  sort_order: number;
}

export const CYBER_THEMES: CyberTheme[] = [
  {
    theme_id: "soft-girl-aesthetic",
    title: "Soft Girl Aesthetic",
    description_line1: "Visual Style: Pastel shades, delicate floral elements, rounded cards, gentle typography, and dreamy Pinterest-inspired design.",
    description_line2: "What to Create: Style an airy pastel interface with pillowy rounded containers, delicate daisy/blush motifs, and soft dreamy gradients.",
    instructions: "Create a soft, delicate pastel aesthetic with gentle curves, subtle floral accents, light airy cards, and Pinterest-inspired layout patterns.",
    palette: [
      { name: "Petal Pink", hex: "#ffd1dc" },
      { name: "Cloud White", hex: "#fff5f7" },
      { name: "Baby Lavender", hex: "#e8d7ff" },
      { name: "Soft Sage", hex: "#d8f3dc" }
    ],
    visual_style: "soft-girl",
    sort_order: 1
  },
  {
    theme_id: "cottagecore",
    title: "Cottagecore",
    description_line1: "Visual Style: Countryside cottages, wildflowers, vintage textures, earthy natural tones, and cozy rustic layouts.",
    description_line2: "What to Create: Build a cozy woodland interface with earthy warm backgrounds, botanical illustrations, vintage paper cards, and floral badges.",
    instructions: "Design a warm rustic aesthetic using antique paper tones, sage greens, wildflower motifs, and handcrafted countryside charm.",
    palette: [
      { name: "Rustic Earth", hex: "#4a3b32" },
      { name: "Wild Moss", hex: "#87986a" },
      { name: "Vintage Cream", hex: "#fbf6ee" },
      { name: "Sunlit Terracotta", hex: "#c97a56" }
    ],
    visual_style: "cottagecore",
    sort_order: 2
  },
  {
    theme_id: "dark-academia",
    title: "Dark Academia",
    description_line1: "Visual Style: Old university libraries, antique leather-bound books, sophisticated serif typography, and rich scholarly colors.",
    description_line2: "What to Create: Craft an Oxford study room aesthetic with deep espresso backgrounds, gold gilded trims, wax-seal badges, and classic editorial typography.",
    instructions: "Build a scholarly atmosphere with dark woods, aged parchment cards, rich gold highlights, and classic serif editorial hierarchy.",
    palette: [
      { name: "Library Espresso", hex: "#1c140e" },
      { name: "Antique Gold", hex: "#c89b3c" },
      { name: "Oxblood Leather", hex: "#5c1d24" },
      { name: "Aged Vellum", hex: "#eae0d0" }
    ],
    visual_style: "dark-academia",
    sort_order: 3
  },
  {
    theme_id: "dreamcore",
    title: "Dreamcore",
    description_line1: "Visual Style: Surreal ethereal landscapes, floating geometric relics, uncanny nostalgic imagery, and dreamlike visual compositions.",
    description_line2: "What to Create: Construct an otherworldly interface featuring floating cloud platforms, twilight violet skies, subtle surrealist halos, and shimmering lucid cards.",
    instructions: "Use surrealist dream gradients, floating ethereal cards, dream-logic composition, and liminal aesthetic visual effects.",
    palette: [
      { name: "Lucid Sky", hex: "#1e1338" },
      { name: "Dream Violet", hex: "#845ec2" },
      { name: "Ethereal Mint", hex: "#b0f2b4" },
      { name: "Twilight Mist", hex: "#fbeaff" }
    ],
    visual_style: "dreamcore",
    sort_order: 4
  },
  {
    theme_id: "japanese-zen-minimalism",
    title: "Japanese Zen Minimalism",
    description_line1: "Visual Style: Generous clean spacing, natural shoji textures, balanced asymmetry, and quiet understated typography.",
    description_line2: "What to Create: Design a serene Zen sanctuary UI with tranquil negative space, washi-paper card borders, subtle bamboo inks, and calm balanced symmetry.",
    instructions: "Implement extreme typographic discipline, vast tranquil whitespace, subtle ink-wash accents, and natural bamboo/stone tones.",
    palette: [
      { name: "Sumi Ink", hex: "#191919" },
      { name: "Washi Rice", hex: "#f7f5f0" },
      { name: "Bamboo Green", hex: "#7a8b6e" },
      { name: "Cinnabar Red", hex: "#b83b32" }
    ],
    visual_style: "zen-minimalism",
    sort_order: 5
  },
  {
    theme_id: "avengers-marvel-universe",
    title: "Avengers / Marvel Universe",
    description_line1: "Visual Style: Superhero-inspired imagery, cinematic high-tech backdrops, bold heroic typography, and dramatic visual particle effects.",
    description_line2: "What to Create: Build an Avengers tactical mission terminal with vibrant Stark-tech HUD borders, vibranium shields, energy core glows, and cinematic heroism.",
    instructions: "Create a heroic, action-oriented interface with bold dynamic slants, vibrant hero reds and arc-reactor cyans, and cinematic energy badges.",
    palette: [
      { name: "Cinematic Dark", hex: "#0b0e14" },
      { name: "Hero Crimson", hex: "#d32f2f" },
      { name: "Arc Cyan", hex: "#00d2ff" },
      { name: "Vibranium Gold", hex: "#fbc02d" }
    ],
    visual_style: "marvel",
    sort_order: 6
  },
  {
    theme_id: "harry-potter-wizarding-world",
    title: "Harry Potter / Wizarding World",
    description_line1: "Visual Style: Enchanted gothic castles, arcane wizarding crests, spell-inspired glowing incantations, and mysterious candlelight illumination.",
    description_line2: "What to Create: Style a Hogwarts common room interface with magical floating candle glows, illuminated parchment scrolls, house-crest shields, and golden snitch sparks.",
    instructions: "Craft a magical wizarding world theme featuring deep starry skies, enchanted gold filigree, parchment textures, and glowing spell incantations.",
    palette: [
      { name: "Midnight Castle", hex: "#0e111a" },
      { name: "Gryffindor Gold", hex: "#d4a34b" },
      { name: "Enchanted Amber", hex: "#ff9100" },
      { name: "Raven Mystery", hex: "#1e3a5f" }
    ],
    visual_style: "wizarding",
    sort_order: 7
  },
  {
    theme_id: "batman-gotham-city",
    title: "Batman / Gotham City",
    description_line1: "Visual Style: Dark noir cityscapes, rain-drenched gothic silhouettes, dramatic high contrasts, and detective bat-computer forensics.",
    description_line2: "What to Create: Recreate Batman's forensic bat-computer with noir monochrome panels, razor-sharp carbon trims, signal-lamp yellow highlights, and rain streaks.",
    instructions: "Design an intense dark noir surveillance interface with matte graphite textures, razor-sharp edges, tactical carbon cards, and Gotham signal amber.",
    palette: [
      { name: "Gotham Obsidian", hex: "#0a0a0c" },
      { name: "Bat Signal Amber", hex: "#f5a623" },
      { name: "Kevlar Charcoal", hex: "#22252a" },
      { name: "Detective Silver", hex: "#8e99a4" }
    ],
    visual_style: "gotham",
    sort_order: 8
  },
  {
    theme_id: "spider-verse",
    title: "Spider-Verse",
    description_line1: "Visual Style: Dynamic comic book panels, halftone screen dots, glitch chromatic aberration, and hyper-saturated urban pop colors.",
    description_line2: "What to Create: Overhaul the layout into a multiverse comic book with skewed panel angles, bright magenta/cyan spray-paint bursts, and pop halftone dots.",
    instructions: "Use bold comic book halftone textures, chromatic RGB offset effects, skewed dynamic angles, and punchy neon comic color blocking.",
    palette: [
      { name: "Brooklyn Void", hex: "#120a2a" },
      { name: "Multiverse Pink", hex: "#ff007f" },
      { name: "Webline Cyan", hex: "#00f0ff" },
      { name: "Spray Yellow", hex: "#ffe600" }
    ],
    visual_style: "spiderverse",
    sort_order: 9
  },
  {
    theme_id: "star-wars-galaxy",
    title: "Star Wars Galaxy",
    description_line1: "Visual Style: Galactic landscapes, starfighter cockpit HUDs, futuristic telemetry interfaces, and cinematic science-fiction visuals.",
    description_line2: "What to Create: Build a starfighter tactical console with Death Star trench schematics, illuminated hyperdrive jump buttons, and blue/red lightsaber energy bars.",
    instructions: "Construct a cinematic sci-fi starship interface with cockpit instrument frames, Aurebesh-inspired typography, and kyber crystal energy lines.",
    palette: [
      { name: "Deep Galaxy", hex: "#05070e" },
      { name: "Kyber Blue", hex: "#29b6f6" },
      { name: "Imperial Crimson", hex: "#e53935" },
      { name: "Jedi Amber", hex: "#ffa000" }
    ],
    visual_style: "starwars",
    sort_order: 10
  },
  {
    theme_id: "minecraft-world",
    title: "Minecraft World",
    description_line1: "Visual Style: Block-shaped elements, pixelated textures, cubic landscapes, and playful voxel game-inspired navigation.",
    description_line2: "What to Create: Convert the webpage into a Minecraft survival HUD with voxel stone containers, green grass block headers, redstone torches, and pixel font menus.",
    instructions: "Adopt authentic 16-bit blocky aesthetics with beveled isometric borders, earthy stone/grass palettes, and retro pixelated typography.",
    palette: [
      { name: "Bedrock Dark", hex: "#1e1e1e" },
      { name: "Grass Top Green", hex: "#5b8731" },
      { name: "Dirt Soil", hex: "#866043" },
      { name: "Diamond Ore", hex: "#4dedf4" }
    ],
    visual_style: "minecraft",
    sort_order: 11
  },
  {
    theme_id: "super-mario-universe",
    title: "Super Mario Universe",
    description_line1: "Visual Style: Cheerful platform game graphics, floating question blocks, golden coins, cartoon clouds, and high-energy Nintendo colors.",
    description_line2: "What to Create: Build a joyful Super Mario platformer world with bouncy question-mark reward buttons, green warp pipe dividers, and super-mushroom energy cards.",
    instructions: "Create a playful, cheerful retro platformer aesthetic with bright primary colors, bouncy rounded buttons, and iconic coin/mushroom visual motifs.",
    palette: [
      { name: "Sky Kingdom Blue", hex: "#5c94fc" },
      { name: "Mario Red", hex: "#e52521" },
      { name: "Question Block Gold", hex: "#fcd116" },
      { name: "Warp Pipe Green", hex: "#00a800" }
    ],
    visual_style: "mario",
    sort_order: 12
  },
  {
    theme_id: "retro-arcade",
    title: "Retro Arcade",
    description_line1: "Visual Style: Chunky pixel fonts, glowing CRT scanlines, retro high-score leaderboards, and nostalgic 1980s coin-op gaming visuals.",
    description_line2: "What to Create: Transform the page into an authentic 80s arcade cabinet marquee with coin-credit tickers, flashy flashing borders, and retro gaming buttons.",
    instructions: "Design an intense 80s arcade cabinet experience featuring CRT scanline overlays, neon pixel typography, and high-score badge containers.",
    palette: [
      { name: "Cabinet Black", hex: "#0c0817" },
      { name: "Arcade Magenta", hex: "#ff1493" },
      { name: "Vector Cyan", hex: "#00ffff" },
      { name: "Insert Coin Gold", hex: "#ffd700" }
    ],
    visual_style: "arcade",
    sort_order: 13
  },
  {
    theme_id: "among-us-space-crew",
    title: "Among Us / Space Crew",
    description_line1: "Visual Style: Cute cartoon spacesuits, modular spaceship bulkheads, starry airlock backgrounds, and playful emergency mystery elements.",
    description_line2: "What to Create: Design the Skeld spaceship emergency tablet with round astronaut glass visors, red emergency meeting alarms, and swipe-card security tasks.",
    instructions: "Adopt a vibrant cartoon sci-fi aesthetic with rounded spacesuit visor shapes, bold comic outlines, and emergency alarm callouts.",
    palette: [
      { name: "Space Void", hex: "#111428" },
      { name: "Crewmate Cyan", hex: "#38fedc" },
      { name: "Impostor Red", hex: "#c51111" },
      { name: "Spaceship Gray", hex: "#71799e" }
    ],
    visual_style: "amongus",
    sort_order: 14
  },
  {
    theme_id: "roblox-universe",
    title: "Roblox Universe",
    description_line1: "Visual Style: Vibrant 3D-inspired game environments, blocky avatar aesthetics, high-energy playful cards, and social metaverse styling.",
    description_line2: "What to Create: Build an interactive Roblox experience launcher with glossy chunky buttons, customizable avatar card slots, and playful experience badges.",
    instructions: "Use bold rounded cards, vibrant punchy gaming colors, modern plastic textures, and playful metaverse dashboard navigation.",
    palette: [
      { name: "Roblox Dark", hex: "#191b1d" },
      { name: "Platform Red", hex: "#e2231a" },
      { name: "Spark Blue", hex: "#00a2ff" },
      { name: "Energy Lime", hex: "#00e676" }
    ],
    visual_style: "roblox",
    sort_order: 15
  },
  {
    theme_id: "medieval-kingdom",
    title: "Medieval Kingdom",
    description_line1: "Visual Style: Ancient stone castles, weathered parchment textures, heraldic royal crests, and classic gothic fantasy typography.",
    description_line2: "What to Create: Rebuild the page into a royal kingdom proclamation scroll with stone masonry borders, gilded heraldic shields, and wax seal approval tags.",
    instructions: "Craft an authentic medieval fantasy experience with aged parchment card backgrounds, iron rivets, royal banners, and gothic headers.",
    palette: [
      { name: "Castle Slate", hex: "#1a1617" },
      { name: "Royal Gold", hex: "#c59b27" },
      { name: "Banner Crimson", hex: "#7a1c1c" },
      { name: "Parchment Tan", hex: "#e9dac1" }
    ],
    visual_style: "medieval",
    sort_order: 16
  },
  {
    theme_id: "ancient-egypt",
    title: "Ancient Egypt",
    description_line1: "Visual Style: Golden pharaonic pyramids, mystical hieroglyphics, lapis lazuli jewel accents, and ancient royal temple motifs.",
    description_line2: "What to Create: Style a golden tomb treasury with hieroglyphic stone tablet cards, deep lapis blue navigation bars, and gleaming sun-god gold borders.",
    instructions: "Combine sand-textured stone backdrops with opulent royal golds, lapis lazuli blues, turquoise gems, and hieroglyphic glyph borders.",
    palette: [
      { name: "Pharaoh Obsidian", hex: "#120f09" },
      { name: "Tomb Gold", hex: "#e5a93c" },
      { name: "Lapis Lazuli", hex: "#154388" },
      { name: "Nile Turquoise", hex: "#2bb3ab" }
    ],
    visual_style: "egypt",
    sort_order: 17
  },
  {
    theme_id: "norse-mythology-vikings",
    title: "Norse Mythology / Vikings",
    description_line1: "Visual Style: Viking longships, glowing elder runestones, frosty Nordic fjord landscapes, and legendary warrior imagery.",
    description_line2: "What to Create: Construct a Valhalla chieftain hall terminal with runic stone carvings, cold Nordic sea mist, weathered wood planks, and blazing hearth fire glow.",
    instructions: "Design a fierce Viking aesthetic with weathered timber, carved stone runes, frosty fjord blues, and embers from a Nordic hearth.",
    palette: [
      { name: "Fjord Abyss", hex: "#0e161c" },
      { name: "Rune Frost Blue", hex: "#52b2cf" },
      { name: "Viking Steel", hex: "#889ba8" },
      { name: "Hearth Amber", hex: "#d97736" }
    ],
    visual_style: "vikings",
    sort_order: 18
  },
  {
    theme_id: "jurassic-park-adventure",
    title: "Jurassic Park Adventure",
    description_line1: "Visual Style: Prehistoric dinosaur habitats, dense tropical rainforest jungles, high-voltage warning signs, and tactical amber park badges.",
    description_line2: "What to Create: Recreate the Isla Nublar park control terminal with high-voltage perimeter warnings, jungle camouflage cards, and amber mosquito fossil badges.",
    instructions: "Build an exciting island safari security terminal with hazard yellow/red stripes, dense jungle greens, and dinosaur expedition badges.",
    palette: [
      { name: "Jungle Shadow", hex: "#0d180f" },
      { name: "Hazard Yellow", hex: "#ffd000" },
      { name: "Amber Fossil", hex: "#d47500" },
      { name: "Deep Canopy", hex: "#1d472b" }
    ],
    visual_style: "jurassic",
    sort_order: 19
  },
  {
    theme_id: "pirate-treasure-hunt",
    title: "Pirate Treasure Hunt",
    description_line1: "Visual Style: Weathered sea charts, brass navigational compasses, sunken gold chests, and legendary nautical sailing ships.",
    description_line2: "What to Create: Transform the UI into a vintage treasure map with burned parchment edges, skull-and-crossbones compass roses, and doubloon gold buttons.",
    instructions: "Use nautical antiquities, weathered map contours, brass compass rose decorations, doubloon gold highlights, and oceanic teakwood.",
    palette: [
      { name: "Ocean Teak", hex: "#1c140c" },
      { name: "Doubloon Gold", hex: "#d8a32a" },
      { name: "Map Parchment", hex: "#e7ce9e" },
      { name: "Sea Storm Blue", hex: "#1e374b" }
    ],
    visual_style: "pirate",
    sort_order: 20
  },
  {
    theme_id: "vogue-luxury-fashion-editorial",
    title: "Vogue / Luxury Fashion Editorial",
    description_line1: "Visual Style: High-fashion editorial photography, sophisticated Didot serif typography, sleek magazine layouts, and haute-couture storytelling.",
    description_line2: "What to Create: Redesign the layout into a Parisian luxury fashion editorial with oversized elegant mastheads, razor-thin rule dividers, and monochrome runway poise.",
    instructions: "Enforce supreme high-fashion editorial aesthetics: dramatic Didot serif headlines, generous architectural whitespace, and monochrome elegance.",
    palette: [
      { name: "Atelier Black", hex: "#080808" },
      { name: "Haute Cream", hex: "#f8f5f0" },
      { name: "Champagne Gold", hex: "#d4af37" },
      { name: "Editorial Gray", hex: "#737373" }
    ],
    visual_style: "vogue",
    sort_order: 21
  },
  {
    theme_id: "nike-sports-performance",
    title: "Nike / Sports Performance",
    description_line1: "Visual Style: High-intensity athletic photography, oversized italic headlines, energetic kinetic compositions, and performance-driven visuals.",
    description_line2: "What to Create: Craft an adrenaline-fueled sports performance hub with bold slanted racing typography, electric volt-green highlights, and speed-streak dividers.",
    instructions: "Create high-impact athletic energy using heavy slanted typography, aggressive high-contrast black/white, and electric volt neon accents.",
    palette: [
      { name: "Pure Carbon", hex: "#111111" },
      { name: "Volt Neon", hex: "#cefa05" },
      { name: "Optic White", hex: "#ffffff" },
      { name: "Velocity Orange", hex: "#ff5500" }
    ],
    visual_style: "nike",
    sort_order: 22
  },
  {
    theme_id: "spotify-music-universe",
    title: "Spotify Music Universe",
    description_line1: "Visual Style: Vibrant vinyl album artwork, dark mode music discovery playlists, audio equalizer waves, and immersive sound visuals.",
    description_line2: "What to Create: Rebuild the webpage as a futuristic streaming audio deck with glowing Spotify-green play controls, blurred album backdrop halos, and waveform bars.",
    instructions: "Adopt Spotify's signature dark UI: deep matte black backgrounds, iconic Spotify green buttons, smooth playlist cards, and waveform accents.",
    palette: [
      { name: "Spotify Pitch Black", hex: "#121212" },
      { name: "Iconic Green", hex: "#1db954" },
      { name: "Elevated Charcoal", hex: "#282828" },
      { name: "Sonic White", hex: "#ffffff" }
    ],
    visual_style: "spotify",
    sort_order: 23
  },
  {
    theme_id: "nasa-space-exploration",
    title: "NASA Space Exploration",
    description_line1: "Visual Style: High-resolution planetary imagery, mission control telemetry dashboards, spacecraft schematics, and clean scientific data panels.",
    description_line2: "What to Create: Build an Apollo/Artemis mission telemetry console with mission clock counters, orbital trajectory curves, clean scientific labels, and NASA blue badges.",
    instructions: "Style a precise NASA aerospace control console with clean mission telemetry cards, technical badges, rocket schematics, and deep space navy.",
    palette: [
      { name: "Cape Canaveral Navy", hex: "#0b1528" },
      { name: "NASA Insignia Blue", hex: "#0b3d91" },
      { name: "Mission Red", hex: "#fc3d21" },
      { name: "Telemetry White", hex: "#f1f5f9" }
    ],
    visual_style: "nasa",
    sort_order: 24
  },
  {
    theme_id: "cozy-coffee-shop",
    title: "Cozy Coffee Shop",
    description_line1: "Visual Style: Warm ambient lighting, rich roasted coffee tones, handcrafted blackboard menu cards, and a relaxed café atmosphere.",
    description_line2: "What to Create: Design an artisan coffee bar menu with warm mocha backgrounds, latte foam swirls, cinnamon gradient highlights, and chalkboard chalk badges.",
    instructions: "Create an inviting, cozy atmosphere with warm espresso and caramel shades, soft rounded corners, blackboard cards, and warm café lighting.",
    palette: [
      { name: "Roasted Espresso", hex: "#2b1810" },
      { name: "Warm Caramel", hex: "#c48b52" },
      { name: "Latte Cream", hex: "#f3e9dc" },
      { name: "Cinnamon Amber", hex: "#8a4b27" }
    ],
    visual_style: "coffee",
    sort_order: 25
  },
  {
    theme_id: "enchanted-forest",
    title: "Enchanted Forest",
    description_line1: "Visual Style: Bioluminescent flora, mossy woodland textures, misty twilight pathways, and magical fairy forest illumination.",
    description_line2: "What to Create: Style a mythical fairy woodland interface with glowing bioluminescent mushroom lamps, ethereal green moss containers, and shimmering spore particles.",
    instructions: "Construct a glowing mythical forest aesthetic with deep evergreen shadows, luminous lime spore accents, and soft woodland mist.",
    palette: [
      { name: "Deep Woodland", hex: "#07170e" },
      { name: "Bioluminescent Lime", hex: "#39ff14" },
      { name: "Misty Emerald", hex: "#1c6e43" },
      { name: "Fairy Spore Gold", hex: "#e2e062" }
    ],
    visual_style: "enchanted-forest",
    sort_order: 26
  },
  {
    theme_id: "interstellar-travel",
    title: "Interstellar Travel",
    description_line1: "Visual Style: Distant deep galaxies, hyperspace navigation coordinates, orbital planetary ellipses, and deep-space telescope imagery.",
    description_line2: "What to Create: Construct a warp-drive spaceship bridge with starlight speed-streak backdrops, orbital gravity well graphs, and sleek void glass panels.",
    instructions: "Use deep space darks, glowing starlight points, orbital circular curves, and cyan/purple nebula gradients to simulate interstellar flight.",
    palette: [
      { name: "Hyperspace Void", hex: "#040510" },
      { name: "Pulsar Cyan", hex: "#48e5c2" },
      { name: "Nebula Violet", hex: "#7f5af0" },
      { name: "Starlight Silver", hex: "#e0e6ed" }
    ],
    visual_style: "interstellar",
    sort_order: 27
  },
  {
    theme_id: "wild-west",
    title: "Wild West",
    description_line1: "Visual Style: Sun-scorched desert canyons, vintage wanted posters, weathered saloon timber, and rugged frontier slab-serif typography.",
    description_line2: "What to Create: Build an outlaw frontier saloon UI with aged wanted-poster cards, desert sand backgrounds, brass sheriff badge stars, and rugged wooden slats.",
    instructions: "Adopt a rugged frontier aesthetic with sunbaked earth tones, weathered timber, wanted poster borders, and classic western slab typography.",
    palette: [
      { name: "Saloon Timber", hex: "#2b1911" },
      { name: "Desert Sand", hex: "#dfb15b" },
      { name: "Canyon Rust", hex: "#9b3d12" },
      { name: "Sheriff Brass", hex: "#e3ad38" }
    ],
    visual_style: "wild-west",
    sort_order: 28
  },
  {
    theme_id: "tropical-paradise",
    title: "Tropical Paradise",
    description_line1: "Visual Style: Sunlit island scenery, lush palm foliage, sparkling turquoise water, and vibrant tropical resort travel layouts.",
    description_line2: "What to Create: Transform the page into a luxury island getaway with crystal-clear turquoise waters, hibiscus floral accents, and sunny resort card frames.",
    instructions: "Design an invigorating tropical resort experience with turquoise lagoons, lush palm greens, sunset coral pinks, and breezy airy layouts.",
    palette: [
      { name: "Lagoon Turquoise", hex: "#00b4d8" },
      { name: "Palm Frond Green", hex: "#2d6a4f" },
      { name: "Coral Sunset", hex: "#ff758f" },
      { name: "Island Sand", hex: "#fff1e6" }
    ],
    visual_style: "tropical",
    sort_order: 29
  },
  {
    theme_id: "dreamy-lavender",
    title: "Dreamy Lavender",
    description_line1: "Visual Style: Provence lavender fields, soft purple-to-pink gradients, delicate botanicals, and peaceful lilac-inspired visuals.",
    description_line2: "What to Create: Style a peaceful aromatherapy retreat portal with soft violet frosted glass, gentle lavender bud illustrations, and calm rounded cards.",
    instructions: "Create a serene, calming aesthetic dominated by soft lilac and lavender shades, gentle glassmorphism, and tranquil typography.",
    palette: [
      { name: "Deep Lavender", hex: "#2d1b4e" },
      { name: "Lilac Bloom", hex: "#b5838d" },
      { name: "Soft Lavender", hex: "#e2cfea" },
      { name: "Mist Pearl", hex: "#f7f2f9" }
    ],
    visual_style: "lavender",
    sort_order: 30
  },
  {
    theme_id: "y2k-futurism",
    title: "Y2K Futurism",
    description_line1: "Visual Style: Glossy chrome lettering, bubblegum inflatable surfaces, playful cyber icons, and nostalgic early-2000s digital optimism.",
    description_line2: "What to Create: Build an authentic year-2000 cyber-pop web portal with liquid metallic chrome badges, bubble-gum pink cards, and cute 2000s cyber sparkles.",
    instructions: "Channel late 90s/early 2000s cyber-optimism with iridescent chrome gradients, bubble outlines, glossy pill buttons, and playful metallic sheen.",
    palette: [
      { name: "Cyber Silver", hex: "#1a1c29" },
      { name: "Chrome Mirror", hex: "#d0d7de" },
      { name: "Bubblegum Pink", hex: "#ff66cc" },
      { name: "Cyber Ice", hex: "#70d6ff" }
    ],
    visual_style: "y2k",
    sort_order: 31
  },
  {
    theme_id: "steampunk-invention",
    title: "Steampunk Invention",
    description_line1: "Visual Style: Victorian brass machinery, interlocking clockwork gears, burnished copper textures, and industrial steam gauges.",
    description_line2: "What to Create: Construct a Victorian inventor workshop workbench with rotating brass cogwheel borders, analog pressure dials, and rivet-fastened bronze panels.",
    instructions: "Design an elaborate Victorian industrial invention console featuring brushed brass, interlocking gears, copper rivets, and analog pressure gauges.",
    palette: [
      { name: "Industrial Coal", hex: "#1b140e" },
      { name: "Burnished Brass", hex: "#d49b3d" },
      { name: "Steam Copper", hex: "#b85d19" },
      { name: "Piston Iron", hex: "#5c504a" }
    ],
    visual_style: "steampunk",
    sort_order: 32
  },
  {
    theme_id: "haunted-mansion",
    title: "Haunted Mansion",
    description_line1: "Visual Style: Gothic manor architecture, eerie candle shadows, swirling fog backgrounds, and mysterious spectral apparitions.",
    description_line2: "What to Create: Style a spooky haunted parlor with swirling graveyard mist, wrought-iron cobweb gates, ghostly phantom green glows, and gothic frames.",
    instructions: "Create a chilling gothic horror environment with pitch-black shadows, eerie cemetery mist, spectral green glows, and weathered haunted architecture.",
    palette: [
      { name: "Midnight Crypt", hex: "#0b0c10" },
      { name: "Phantom Green", hex: "#66fcf1" },
      { name: "Spectral Lilac", hex: "#a480cf" },
      { name: "Gothic Cobweb", hex: "#45a29e" }
    ],
    visual_style: "haunted",
    sort_order: 33
  },
  {
    theme_id: "pop-art-comic-book",
    title: "Pop Art Comic Book",
    description_line1: "Visual Style: Roy Lichtenstein speech bubbles, heavy Ben-Day dot patterns, oversized graphic sound effects, and explosive primary colors.",
    description_line2: "What to Create: Rebuild the webpage into an explosive Pop Art gallery with POW! speech bubble banners, thick black comic outlines, and bold primary color dots.",
    instructions: "Adopt authentic Lichtenstein pop-art styling with thick black graphic contours, Ben-Day dot halftone fills, and screaming high-contrast primary colors.",
    palette: [
      { name: "Ink Black", hex: "#000000" },
      { name: "Pop Yellow", hex: "#ffe600" },
      { name: "Action Red", hex: "#ff0033" },
      { name: "Comic Cyan", hex: "#00b2fe" }
    ],
    visual_style: "pop-art",
    sort_order: 34
  },
  {
    theme_id: "iron-man-lab",
    title: "Iron Man Lab",
    description_line1: "Visual Style: Holographic Jarvis schematics, Mark armour technical diagrams, hot-rod red and gold armor plating, and glowing arc reactor power cores.",
    description_line2: "What to Create: Design Tony Stark's Malibu laboratory HUD with floating holographic armor blueprints, arc reactor power gauges, and hot-rod crimson plating.",
    instructions: "Build an elite high-tech laboratory HUD with hot-rod red and gold accents, glowing arc reactor cyans, and floating technical wireframe diagnostics.",
    palette: [
      { name: "Stark Armor Red", hex: "#8b0000" },
      { name: "Hot Rod Gold", hex: "#ffcc00" },
      { name: "Arc Core Cyan", hex: "#00f7ff" },
      { name: "Titanium Chassis", hex: "#14171f" }
    ],
    visual_style: "iron-man",
    sort_order: 35
  },
  {
    theme_id: "k-pop-star",
    title: "K-Pop Star",
    description_line1: "Visual Style: Stadium arena concert lighting, album photobook graphics, bold energetic typography, and sleek music video glamour.",
    description_line2: "What to Create: Create a dynamic K-Pop idol comeback launch page with sparkling stage spotlight glows, pastel neon gradients, and stylish photocard containers.",
    instructions: "Design an electrifying K-Pop concert and photobook aesthetic with laser stage spotlights, sparkling neon gradients, and stylish modern typography.",
    palette: [
      { name: "Stage Midnight", hex: "#110b22" },
      { name: "Comeback Magenta", hex: "#ff2a85" },
      { name: "Lightstick Cyan", hex: "#05d9e8" },
      { name: "Glitz Purple", hex: "#7b2cbf" }
    ],
    visual_style: "k-pop",
    sort_order: 36
  },
  {
    theme_id: "formula-1-racing",
    title: "Formula 1 Racing",
    description_line1: "Visual Style: High-speed Grand Prix racecars, telemetry track circuit graphics, aerodynamic carbon weaves, and high-octane motorsport branding.",
    description_line2: "What to Create: Construct a pit-wall telemetry timing board with live sector timing deltas, carbon-fiber textured cards, and checkered flag racing stripes.",
    instructions: "Build a high-octane motorsport dashboard featuring racing red accents, carbon-fiber textures, speed-gauge deltas, and sharp aerodynamic cards.",
    palette: [
      { name: "Tarmac Carbon", hex: "#121316" },
      { name: "Scuderia Red", hex: "#e10600" },
      { name: "Track Apex White", hex: "#ffffff" },
      { name: "Sector Yellow", hex: "#ffeb3b" }
    ],
    visual_style: "f1",
    sort_order: 37
  },
  {
    theme_id: "football-champions",
    title: "Football Champions",
    description_line1: "Visual Style: Floodlit championship stadiums, pristine pitch turf, team lineup cards, match scoreboards, and golden trophy prestige.",
    description_line2: "What to Create: Recreate a Champions League matchday dashboard with stadium night floodlight beams, pitch-grass green cards, and golden championship trophy badges.",
    instructions: "Design a prestigious tournament arena aesthetic with stadium floodlights, emerald pitch turf colors, championship gold medals, and scoreboard cards.",
    palette: [
      { name: "Stadium Night", hex: "#0a1118" },
      { name: "Pitch Emerald", hex: "#1b8a43" },
      { name: "Trophy Gold", hex: "#f4c430" },
      { name: "Match Floodlight", hex: "#e0f2fe" }
    ],
    visual_style: "football",
    sort_order: 38
  }
];

export function allocateThemesWithoutRepetition(
  teamIds: string[],
  seed = "visual-intelligence-round-1-themes-2026"
): Map<string, { theme: CyberTheme }> {
  // Deterministic 32-bit FNV-1a hash
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  let state = (hash >>> 0) % 2147483647;
  if (state <= 0) state += 2147483646;

  const nextRng = () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };

  // Shuffle theme pool
  const themePool = [...CYBER_THEMES];
  for (let i = themePool.length - 1; i > 0; i--) {
    const j = Math.floor(nextRng() * (i + 1));
    [themePool[i], themePool[j]] = [themePool[j], themePool[i]];
  }

  // Sort team IDs stably
  const sortedTeamIds = [...teamIds].sort();
  const map = new Map<string, { theme: CyberTheme }>();

  sortedTeamIds.forEach((id, index) => {
    map.set(id, {
      theme: themePool[index % themePool.length],
    });
  });

  return map;
}
