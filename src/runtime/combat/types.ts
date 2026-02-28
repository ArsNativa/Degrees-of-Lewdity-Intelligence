/**
 * Combat Narrator — shared type definitions.
 *
 * Defines the State Snapshot structure (§3.2) and Mechanism Event types (§3.3)
 * used by state collection, event extraction, and prompt rendering.
 */

// ── Mechanism Event (§3.3) ─────────────────────────────────

/** A single normalized mechanism event extracted from intent + delta. */
export interface MechanismEvent {
  /** Hierarchical type, e.g. "milestone.virginity_loss", "contact.hand_engage". */
  eventType: string;
  /** Actor: -1 = player, 0–5 = NPC slot, null = system. */
  actorSlot: number | null;
  /** Target: -1 = player, 0–5 = NPC slot, null = N/A. */
  targetSlot: number | null;
  /** Relevant intent signals (e.g. action variable values). */
  intent: Record<string, any>;
  /** Key state changes that evidence this event. */
  delta: Record<string, any>;
  /** Outcome classification. */
  outcome: 'success' | 'fail' | 'refused' | 'hit' | 'miss' | 'observed';
  /** Field names that triggered the rule. */
  evidence: string[];
  /** Trigger source description. */
  provenance: string;
  /** Sort priority (lower = higher priority). 1=milestone, 2=control, …, 9=name_switch. */
  priority: number;
}

/** Player action intent snapshot — captured from combat action variables. */
export interface IntentSnapshot {
  leftaction: string | number;
  rightaction: string | number;
  mouthaction: string | number;
  feetaction: string | number;
  penisaction: string | number;
  vaginaaction: string | number;
  anusaction: string | number;
  chestaction: string | number;
  thighaction: string | number;
  askAction: string | number;
  mockaction: string | number;
  /** Player-targeted NPC slots. */
  mouthtarget: number | string;
  lefttarget: number | string;
  righttarget: number | string;
  feettarget: number | string;
}

/** State delta between two consecutive snapshots. */
export interface DeltaSnapshot {
  // ── Numeric deltas ──
  arousalDelta: number;
  painDelta: number;
  stressDelta: number;
  traumaDelta: number;
  controlDelta: number;
  // ── Enemy aggregate deltas ──
  enemyHealthDelta: number;
  enemyArousalDelta: number;
  enemyAngerDelta: number;
  enemyTrustDelta: number;
  // ── Body-part changes ──
  bodyUseChanges: FieldChange[];
  bodyStateChanges: FieldChange[];
  // ── Virginity losses (true → non-true) ──
  playerVirginityLost: string[];
  npcVirginityLost: { npcSlot: number; type: string }[];
  // ── Clothing changes ──
  clothingChanges: ClothingChange[];
  // ── NPC body-targeting changes ──
  npcBodyChanges: { npcSlot: number; field: string; from: any; to: any }[];
  // ── Position change ──
  positionChange: { from: string; to: string } | null;
  // ── Consensual change ──
  consensualChange: { from: boolean; to: boolean } | null;
  // ── NPC display-name changes (for name_alias_switch) ──
  nameChanges: { npcSlot: number; from: string; to: string }[];
}

/** A single field change record. */
export interface FieldChange {
  field: string;
  from: any;
  to: any;
}

/** A clothing slot change record. */
export interface ClothingChange {
  slot: string;
  field: string;
  from: any;
  to: any;
}

/** Full extraction context passed to the normalizer. */
export interface ExtractionContext {
  intent: IntentSnapshot;
  delta: DeltaSnapshot;
  prevState: StateSnapshot;
  currState: StateSnapshot;
}

// ── State Snapshot (§3.2) ──────────────────────────────────

/** World context at time of snapshot. */
export interface WorldSnapshot {
  /** Primary location set by the current scene (e.g. "school", "park"). */
  location: string;
  /** Current passage name — always accurate, gives fine-grained context. */
  passage: string;
  dayState: string;       // dawn / day / dusk / night
  hour: number;
  weather: string;
  season: string;
  outside: boolean;
}

/** Player combat-relevant state. */
export interface PlayerSnapshot {
  gender: string;
  arousal: number;
  arousalMax: number;
  pain: number;
  /** Raw DoL pain-overwhelm latch: `0` means overwhelmed, `null` means unset/undefined. */
  willpowerpain: number | null;
  stress: number;
  stressMax: number;
  trauma: number;
  traumaMax: number;
  control: number;
  controlMax: number;
  submissive: number;
  /** Body-part occupation map (e.g. mouthuse → "penis"). */
  bodyUse: Record<string, string | number>;
  /** Body-part detailed state (e.g. vaginastate → "penetrated"). */
  bodyState: Record<string, string | number>;
  /** Virginity map (true = still virgin). */
  virginity: Record<string, boolean>;
  /** Active status effects relevant to combat. */
  effects: {
    dissociation: number;
    trance: number;
    possessed: boolean;
    drunk: number;
    drugged: number;
    orgasmCooldown: number;
    panicViolence: number;
    panicParalysis: number;
  };
}

/**
 * Persistent relationship data for named NPCs (§3.2.3).
 *
 * Sourced from `C.npc[name]` / `$NPCName[idx]` — the long-lived NPC
 * record that persists across saves, NOT the combat-local `$NPCList` copy.
 * Only populated when the combat NPC slot maps to a named NPC via `$npcrow`.
 */
export interface NamedNpcContext {
  /** Canonical NPC name (e.g. "Robin", "Sydney", "Whitney"). */
  npcName: string;
  /** Persistent love/affection value towards the player. */
  love: number;
  /** Persistent lust value towards the player. */
  lust: number;
  /** Persistent dominance value. */
  dom: number;
  /** Persistent rage/anger value towards the player. */
  rage: number;
  /** Whether this NPC is a love interest (in `setup.loveInterestNpc`). */
  isLoveInterest: boolean;
  /** Localised relationship alias (e.g. "爱人", "男友"), resolved from `setup.loveAlias`. */
  loveAlias: string;
}

/** Single NPC in the combat encounter — Entity Anchor (§3.2.1). */
export interface NpcSnapshot {
  npcSlot: number;
  displayNameCurrent: string;
  displayNameInitial: string;
  displayNamePrev: string;
  aliasHint: string | null;
  rawIdentity: {
    fullDescription: string;
    description: string;
    role: string;
    nameKnown: boolean;
    pronoun: string;
    gender: string;
    type: string;
  };
  /** NPC body-part targeting. */
  body: {
    lefthand: string | number;
    righthand: string | number;
    mouth: string | number;
    penis: string | number;
    vagina: string | number;
    chest: string | number;
  };
  health: number;
  healthMax: number;
  arousal: number;
  trust: number;
  stance: string;
  insecurity: string;
  penisSize: number;
  active: boolean;
  /** NPC virginity map (true = still virgin). */
  virginity: Record<string, boolean>;
  /**
   * Persistent relationship context for named NPCs (§3.2.3).
   * `null` for generic (randomly generated) NPCs.
   */
  namedNpcContext: NamedNpcContext | null;
}

/** Combat meta-state. */
export interface CombatSnapshot {
  turnIndex: number;
  position: string;
  consensual: boolean;
  enemyType: string;
  enemyCount: number;
  enemyHealth: number;
  enemyHealthMax: number;
  enemyArousal: number;
  enemyArousalMax: number;
  enemyAnger: number;
  enemyAngerMax: number;
  enemyTrust: number;
}

/** Clothing item state (per-slot). */
export interface ClothingSlotSnapshot {
  slot: string;
  name: string;
  integrity: number;
  integrityMax: number;
  state: string | number;
  exposed: number;
  vaginaExposed: number;
  anusExposed: number;
}

/** Full State Snapshot — §3.2 aggregate. */
export interface StateSnapshot {
  world: WorldSnapshot;
  player: PlayerSnapshot;
  npcs: NpcSnapshot[];
  combat: CombatSnapshot;
  clothing: ClothingSlotSnapshot[];
}

// ── Entity Anchor Tracking ──────────────────────────────────

/** Per-combat tracking data for NPC display-name continuity. */
export interface EntityAnchorState {
  /** First-seen display name this combat. */
  initialNames: Map<number, string>;
  /** Previous-turn display name. */
  prevNames: Map<number, string>;
  /** Set of (slot, oldName→newName) pairs already hinted once. */
  hintedSwitches: Set<string>;
}
