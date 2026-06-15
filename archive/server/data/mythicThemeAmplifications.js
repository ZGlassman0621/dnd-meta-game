/**
 * Mythic × Theme Amplifications Seed Data
 *
 * 11 resonant amplifications + 7 dissonant arcs. Sourced from
 * MYTHIC_THEME_AMPLIFICATIONS.md. Resonant combos grant automatic tier-scaling
 * bonuses; dissonant combos unlock narrative arcs with mechanical payoffs that
 * scale with atonement/reconciliation acts tracked by the AI DM.
 *
 * Note: Redemption Path and Corrupted Dawn Path are Shadow Paths that are
 * inherently arc-based — they are tracked via the mythic_arcs table rather
 * than as fixed path+theme pairings. They're referenced here conceptually but
 * not listed as specific amplifications.
 */

export const MYTHIC_THEME_AMPLIFICATIONS = [
  // ============ RESONANT AMPLIFICATIONS (11) ============
  { mythic_path: 'hierophant', theme_id: 'acolyte', combo_name: 'Saintly Vessel', is_dissonant: 0,
    shared_identity: 'Faith as foundation. Both paths assume the character\'s relationship with the divine is central to who they are.',
    t1_bonus: 'Mythic Power pool expands by 1. Spiritual Counsel can be performed during a short rest (not consuming the once-per-long-rest limit) on a creature who received your Hierophant blessing.',
    t2_bonus: 'Faithkeeper blessing lasts 2 hours (instead of 1). Recipients gain +1 Hierophant Surge die on attack rolls (d4 at T2).',
    t3_bonus: 'Divine Intercessor Heal option also restores one Mythic Power to each Mythic ally within 30 ft.',
    t4_bonus: 'Treated as a legitimate cleric of your chosen deity regardless of class. Your deity pays personal attention — the AI DM may deliver direct signs, visions, or minor miracles.' },
  { mythic_path: 'angel', theme_id: 'knight_of_the_order', combo_name: 'Celestial Chevalier', is_dissonant: 0,
    shared_identity: 'Sworn service made cosmic. The Knight\'s oath ascends to the level of divine contract.',
    t1_bonus: 'Oath Unbroken save advantage extends to divine damage types (necrotic, fire from fiendish sources).',
    t2_bonus: 'When using Banner of the Order, wings manifest briefly. An ally within 60 ft can be granted flight at their walking speed for the duration.',
    t3_bonus: 'Paragon aura additionally grants resistance to radiant AND necrotic damage to allies within 15 ft during its duration.',
    t4_bonus: 'Once per long rest, summon a celestial herald (CR ≈ 1/4 character level) to fight alongside you for 1 hour.' },
  { mythic_path: 'azata', theme_id: 'entertainer', combo_name: 'The Muse-Touched', is_dissonant: 0,
    shared_identity: 'Wild beauty, creative chaos, freedom. The Azata finds the Entertainer\'s art a form of cosmic poetry.',
    t1_bonus: 'Read the Room also reveals the crowd\'s dominant emotional longing — what they wish for that they cannot name.',
    t2_bonus: 'Showstopper charm affects fey creatures normally (not immune). Charmed targets feel genuine joy rather than just magical compulsion.',
    t3_bonus: 'Legend of the Stage performance options (Anthem/Dirge/Ballad) have 120-ft radius (instead of 60 ft).',
    t4_bonus: 'Once per long rest, declare a performance that transcends mortal limits — the AI DM narrates a moment where your art literally changes reality (tyrant\'s heart melts, curse breaks, hidden path reveals itself).' },
  { mythic_path: 'gold_dragon', theme_id: 'noble', combo_name: 'Dragon-Blooded Sovereign', is_dissonant: 0,
    shared_identity: 'Legitimate authority made divine. The Noble\'s birthright and the Gold Dragon\'s honor create an archetype of righteous rule.',
    t1_bonus: 'Weight of Name grants advantage on ALL social checks in noble courts, not just political ones. Dragons recognize a peer.',
    t2_bonus: 'Noblesse Oblige commands can be given to creatures of any intelligence (not just commoners/low-ranking).',
    t3_bonus: 'Sovereign Presence deference save becomes Charisma save (not just Wisdom). Targets cannot shake the sense that you are more important than reality suggests.',
    t4_bonus: 'Once per campaign arc, political favor includes personal intervention of a metallic dragon or other lawful good power — armies march, treaties are brokered, kingdoms shift allegiance.' },
  { mythic_path: 'lich', theme_id: 'haunted_one', combo_name: 'The Vessel of Grief', is_dissonant: 0,
    shared_identity: 'Darkness survived becomes darkness wielded. The Haunted One\'s trauma is the foundation stone of the Lich\'s ascension.',
    t1_bonus: 'Mark of Dread channel dread\'s DC is increased by +2 against undead creatures.',
    t2_bonus: 'Inured to Horror fear immunity extends — also immune to charmed/compelled by undead, fiend, or aberration creatures.',
    t3_bonus: 'Gaze into the Abyss Confrontation ability (Banish/Bind/Break) imposes disadvantage on the creature\'s resistances for the duration.',
    t4_bonus: 'Aura of Unease affects ALL supernatural creatures (celestials, fey, elementals) — not just undead, fiends, and aberrations.' },
  { mythic_path: 'trickster', theme_id: 'charlatan', combo_name: 'The Great Deceiver', is_dissonant: 0,
    shared_identity: 'The art of the lie at cosmic scale. The Charlatan\'s mortal deception is amplified by the Trickster\'s chaos magic.',
    t1_bonus: 'Second Skin disguises gain a subtle magical dimension — resist Detect Magic detection as if mundane, though they have faint magical quality. Pass magical scrutiny below 6th level.',
    t2_bonus: 'Web of Lies maintained identities can number up to 5 (instead of 3). Trickster chaos helps you remember them all perfectly.',
    t3_bonus: 'Perfect Con flawless identity duration extends to 24 hours (instead of 8).',
    t4_bonus: 'Once per long rest, enter a state where no lie you tell can be detected as false for 1 hour. Magical detection (Zone of Truth, etc.), divine sight (Divine Sense), truth magic all fail. One of the most powerful social capstones in the system.' },
  { mythic_path: 'aeon', theme_id: 'sage', combo_name: 'The Pattern-Keeper', is_dissonant: 0,
    shared_identity: 'Knowledge as cosmic order. The Sage studies the patterns; the Aeon upholds them.',
    t1_bonus: 'Studied Mind recall ability reveals TWO pieces of information per use (instead of one).',
    t2_bonus: 'Analytical Eye also reveals a creature\'s role in the cosmic pattern — fulfilling destined purpose or acting against it.',
    t3_bonus: 'Living Library\'s deep study takes only 1 minute (instead of 10 minutes), and reveals connections to past events the character may not have personally witnessed.',
    t4_bonus: 'Form of foresight — once per long rest, the AI DM reveals one piece of information about an imminent future event within 24 hours. Not divination; pattern recognition at cosmic scale.' },
  { mythic_path: 'demon', theme_id: 'mercenary_veteran', combo_name: 'The Crimson Contract', is_dissonant: 0,
    shared_identity: 'Blood and rage made profitable. The Mercenary\'s pragmatism meets the Demon\'s chaos.',
    t1_bonus: 'Killing Floor Synergy trigger activates even when solo — +2 to attacks and damage while below half HP. The Demon\'s rage fuels you.',
    t2_bonus: 'Battlefield Opportunist tactical withdrawal deals +1d6 damage per ally you bring to safety. You profit from every life saved.',
    t3_bonus: 'Dead Eye crit regenerates 1 Mythic Power on a hit. Violence feeds your power.',
    t4_bonus: 'Once per long rest, declare a Blood Contract on a target within 60 ft. For 1 minute, every attack against them deals critical damage, and you regain HP equal to half damage dealt. Target must be a creature you\'ve been "hired" to kill (narratively; revenge, protection, etc.).' },
  { mythic_path: 'devil', theme_id: 'noble', combo_name: 'The Pact-Bound Heir', is_dissonant: 0,
    shared_identity: 'Order through binding agreement. Both paths build power through contracts.',
    t1_bonus: 'Weight of Name audiences extend to infernal nobility — can request (via ritual) an audience with a minor devil, who is obligated to hear you out under infernal law.',
    t2_bonus: 'Noblesse Oblige commands are magically reinforced — targets who fail the save feel genuinely compelled. Noble letters of introduction function as minor bargaining chits among infernals.',
    t3_bonus: 'Sovereign Presence extends to fiends — they treat you as a minor infernal noble. Can safely negotiate in devilish courts if careful.',
    t4_bonus: 'Once per campaign arc, political favor can be traded for an infernal favor — call in a debt from a major devil or infernal faction. Scope significant (legion of lesser devils, soul-binding, infernal artifact); cost proportional.' },
  { mythic_path: 'legend', theme_id: 'any', combo_name: 'The Archetype Made Real', is_dissonant: 0,
    shared_identity: 'Legend is the path of mortal mastery at cosmic scale. It amplifies whatever the character already is, making their Theme feel legendary.',
    t1_bonus: 'The Theme\'s L5 ability\'s cooldown is reduced by one step (once per long → once per short; once per short → once per encounter; per encounter → at will).',
    t2_bonus: 'The Theme\'s L11 ability\'s Expertise Die increases by one size (d4 → d6).',
    t3_bonus: 'The Theme\'s L17 capstone\'s cooldown is reduced by one step (once per campaign arc → once per long rest; once per long rest → once per short rest).',
    t4_bonus: 'The character is recognized as a legendary version of their Theme archetype — NPCs and companions of the same Theme treat them as teacher, peer, or aspirational figure.' },

  // ============ DISSONANT ARCS (7) ============
  { mythic_path: 'angel', theme_id: 'criminal', combo_name: 'The Redeemed Thief', is_dissonant: 1,
    shared_identity: 'The Angel\'s pact is pure service to a greater cause; the Criminal\'s life has been betrayal and self-interest. Sometimes the Angel chooses the former criminal specifically BECAUSE they know what they are leaving behind.',
    dissonant_arc_description: 'Character starts with reduced Angel benefits (Mythic Power pool -1, Surge dice one size smaller). As they perform 9 Redemption Acts (major moments of refusing old ways, protecting innocents, returning what was stolen), mechanics gradually restore.',
    required_threshold_acts: 9,
    t4_bonus: 'At full restoration: "The Thief\'s Sacrifice" — once per long rest, steal a divine attack or effect targeting an ally within 60 ft and take it yourself. Any damage it would deal to the ally is dealt to you; any redirected effect (a curse, etc.) is now on you.' },
  { mythic_path: 'demon', theme_id: 'folk_hero', combo_name: 'Rage With Purpose', is_dissonant: 1,
    shared_identity: 'The Demon is pure chaos, hunger, violence for its own sake. The Folk Hero stands FOR something — community, decency, the small folk. These should be incompatible.',
    dissonant_arc_description: 'Character can invoke Demon rage, but each use automatically damages one friendly creature within 10 ft (DM\'s choice). The rage hungers. As the character builds 7 Community Anchors (meaningful moments using rage to PROTECT rather than destroy — saving villagers, stopping raids, intimidating tyrants instead of butchering them), the rage learns restraint.',
    required_threshold_acts: 7,
    t4_bonus: '"Righteous Chaos" — Demon rage can be channeled specifically toward injustice. While raging, +1d6 damage per Mythic tier against creatures common folk call oppressors (tyrants, slavers, corrupt officials). Normal damage bonus vs non-oppressors. The rage chooses its victims.' },
  { mythic_path: 'lich', theme_id: 'acolyte', combo_name: 'The Grieving Priest', is_dissonant: 1,
    shared_identity: 'The Acolyte\'s faith is in life, renewal, the cycle. The Lich\'s power is denial of death. The Acolyte who takes Lich Path has likely lost someone beyond what they could accept.',
    dissonant_arc_description: 'Character can access Lich abilities but each use costs 1 point of their deity\'s Piety (from Piety system). As they build 9 Moments of Acceptance (allowing something to die that they could have prevented, releasing a soul, attending a funeral and truly mourning), the cost diminishes.',
    required_threshold_acts: 9,
    t4_bonus: '"The Vessel That Remembers" — once per long rest, commune with any soul that died within the last year whom you have personally met in life. They answer one question truthfully. Your Lich magic has become a bridge rather than a cage for the dead.' },
  { mythic_path: 'trickster', theme_id: 'knight_of_the_order', combo_name: 'The Masked Oath', is_dissonant: 1,
    shared_identity: 'The Knight\'s oath is absolute; the Trickster\'s power is in breaking rules. A Knight who takes Trickster Path either has a secret that breaks their oath or has realized their oath requires deception to fulfill.',
    dissonant_arc_description: 'Character cannot use Oath Unbroken social benefits while using Trickster abilities in the same session. The two identities cannot publicly coexist. As they perform 7 acts of Secret Service (missions that uphold oath\'s spirit while breaking its letter), the tension crystallizes into synthesis.',
    required_threshold_acts: 7,
    t4_bonus: '"The Hidden Knight" — create a false identity that the magic of your order recognizes as legitimate. Your order accepts the false you; invoke order\'s resources through the false identity without the order realizing two of you exist. Advanced application of oath combined with Trickster deception.' },
  { mythic_path: 'devil', theme_id: 'acolyte', combo_name: 'The Tempted Priest', is_dissonant: 1,
    shared_identity: 'The Acolyte\'s faith is in a divine patron; the Devil\'s pact is literally opposite authority. The Acolyte who takes Devil Path is being tempted, OR has made a desperate bargain in service of their actual faith.',
    dissonant_arc_description: 'Character gains Devil abilities but cannot use Acolyte abilities in the same long rest period — patrons reject each other\'s channel. As they perform 7 Acts of Clarified Faith (using Devil power specifically for purposes aligned with Acolyte faith — deal with a devil to save an innocent, contract that traps a greater evil), they begin to harmonize.',
    required_threshold_acts: 7,
    t4_bonus: '"The Sacred Contract" — once per long rest, make a formal bargain with a creature that is magically binding on both parties. Not simply Infernal contract — carries divine weight too. Breaking invokes both patron\'s displeasure AND deity\'s reaction. Makes you dangerous to cross.' },
  { mythic_path: 'gold_dragon', theme_id: 'urchin', combo_name: 'The Forgotten Heir', is_dissonant: 1,
    shared_identity: 'The Gold Dragon is the paragon of righteous authority; the Urchin has been overlooked, unnamed, invisible. For both to coexist is to discover that the Urchin was ALWAYS something more than they seemed.',
    dissonant_arc_description: 'The AI DM reveals over multiple sessions that the Urchin has significant lineage they never knew — royal bloodline, draconic heritage, divinely-marked birth. As the character investigates and claims pieces of this identity (visiting ancestral sites, being recognized by those who knew the lineage, accepting or refusing the inheritance), Gold Dragon path benefits emerge.',
    required_threshold_acts: 5,
    t4_bonus: '"The Claim" — once per campaign arc, make a formal claim to a legacy (throne, territory, sacred title). The AI DM adjudicates success, but the possibility is always there. Common folk who learn of true lineage respond with either awe or betrayal — navigation of what becoming someone of importance means to those who loved you when you were no one.' },
  { mythic_path: 'angel', theme_id: 'mercenary_veteran', combo_name: 'The Contract Fulfilled', is_dissonant: 1,
    shared_identity: 'The Angel\'s pact is eternal service; the Mercenary\'s contracts are limited, transactional. The Mercenary who takes Angel Path has made a contract with the universe itself — and it came due.',
    dissonant_arc_description: 'Character must periodically honor the Angel pact through acts of selfless service — cannot charge for these. Refusing 3 pact-requested services in a row loses Angel access until atonement. As they perform 7 Pact Services without complaint (or with internal complaint but external compliance), the mercenary\'s identity shifts.',
    required_threshold_acts: 7,
    t4_bonus: '"The Mercenary\'s Gift" — once per long rest, bestow a pact service on another creature. They gain the benefits of an angelic blessing for 1 hour (Angel Surge dice, limited flight, resistance to chosen damage type). Cost is paid by you; cannot gift to the same creature more than once per week. The Mercenary\'s contract is now a gift she gives.' }
];

/**
 * Shadow Paths (Redemption, Corrupted Dawn) are arc-based rather than pairing-based.
 * They are tracked via the mythic_arcs table. Documented here as conceptual reference.
 */
export const SHADOW_PATHS_REFERENCE = {
  redemption: {
    description: 'Scales with atonement acts. AI DM tracks meaningful deeds (saving innocents, refusing temptation, returning what was stolen, bearing witness to atrocity and speaking truth). Each atonement act grants an increment toward the next mechanical threshold.',
    thresholds: {
      t1: '3 atonement acts: Mythic Power pool +1. The path forward begins.',
      t2: '10 atonement acts: Previous lost Theme abilities restore at 50% capacity.',
      t3: '20 atonement acts: Previous Theme abilities fully restored. Gain "Witness" — 1/LR grant an ally moment of clarity about a consequences-laden act.',
      t4: '40 atonement acts: Redemption complete. Theme abilities now BETTER than they were — each gains a small additional effect. Scars become strength.'
    }
  },
  corrupted_dawn: {
    description: 'Dark mirror of Redemption. Scales with corruption acts — calculated cruelty, exploitation of power, betrayal of those who trusted you. AI DM honors the choice without judgment.',
    thresholds: {
      t1: '3 corrupt acts: Mythic Power pool +2 (more generous than Redemption, and more demanding). Disadvantage on Persuasion with good-aligned who know your deeds.',
      t2: '10 corrupt acts: Theme\'s dark abilities (if any) gain enhanced effects. Intimidation becomes almost supernatural.',
      t3: '20 corrupt acts: Gain a Dark Thrall (loyal NPC servant — minor demon, undead, or corrupted mortal). Also acquire a hunter (righteous force actively pursues you).',
      t4: '40 corrupt acts: Transformation complete. Significant dark abilities scaled to your Theme. No longer welcome in most civilized lands. Power + isolation.'
    }
  }
};
