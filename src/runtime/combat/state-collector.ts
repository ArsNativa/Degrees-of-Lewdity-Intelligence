/**
 * StateCollector — collects the State Snapshot (§3.2) from live game state.
 *
 * Reads SugarCube story variables, Time/Weather singletons, and the
 * combat JS object to produce a structured, read-only snapshot of the
 * current combat round context.
 *
 * All reads are wrapped in safeRead() to tolerate missing fields.
 */
import { Logger } from '../../utils/logger.js';
import { safeRead, getV, getC, getSetup, getTime, getWeather, resolveLoveAlias } from '../access.js';
import type {
  StateSnapshot,
  WorldSnapshot,
  PlayerSnapshot,
  NpcSnapshot,
  NamedNpcContext,
  CombatSnapshot,
  ClothingSlotSnapshot,
  EntityAnchorState,
} from './types.js';

const logger = new Logger('Combat/StateCollector');

// Clothing slots to scan (matches setup.clothes_all_slots).
const CLOTHING_SLOTS = [
  'over_upper', 'over_lower', 'upper', 'lower',
  'under_upper', 'under_lower', 'over_head', 'head',
  'face', 'neck', 'hands', 'handheld', 'legs', 'feet', 'genitals',
] as const;

// Body-part "*use" variables to snapshot.
const BODY_USE_KEYS = [
  'mouthuse', 'penisuse', 'vaginause', 'anususe',
  'chestuse', 'thighuse', 'feetuse',
] as const;

// Body-part "*state" variables to snapshot.
const BODY_STATE_KEYS = [
  'mouthstate', 'penisstate', 'vaginastate', 'anusstate',
  'cheststate', 'feetstate',
] as const;

// Virginity sub-keys on `$player.virginity`.
const VIRGINITY_KEYS = [
  'vaginal', 'penile', 'anal', 'oral', 'kiss', 'handholding', 'temple',
] as const;

/** Max NPC slots in DoL combat (0–5). */
const MAX_NPC_SLOTS = 6;

/**
 * Collect a full State Snapshot from the live game state.
 *
 * @param anchorState  Entity Anchor tracking — mutated to update
 *                     initial/prev names and alias hints.
 * @param turnIndex    Current (mod-tracked) turn number.
 */
export function collectStateSnapshot(
  anchorState: EntityAnchorState,
  turnIndex: number,
): StateSnapshot | null {
  const V = getV();
  if (!V) {
    logger.warn('SugarCube state not available — cannot collect snapshot');
    return null;
  }

  // Only collect when combat is active.
  if (safeRead(() => V.combat, 0) !== 1) {
    logger.info('Not in combat — skipping snapshot');
    return null;
  }

  const world = collectWorld(V);
  const player = collectPlayer(V);
  const combat = collectCombat(V, turnIndex);
  const npcs = collectNpcs(V, anchorState);
  const clothing = collectClothing(V);

  logger.info(`Snapshot collected — turn ${turnIndex}, ${npcs.length} NPC(s)`);

  return { world, player, npcs, combat, clothing };
}

// ── World ──────────────────────────────────────────────────

function collectWorld(V: Record<string, any>): WorldSnapshot {
  const T = getTime();
  const W = getWeather();
  return {
    location: safeRead(() => V.location, 'unknown'),
    passage: safeRead(() => (window as any)?.SugarCube?.State?.passage, 'unknown'),
    dayState: safeRead(() => T?.dayState, 'unknown'),
    hour: safeRead(() => T?.hour, 0),
    weather: safeRead(() => W?.name ?? V.weatherObj?.name, 'unknown'),
    season: safeRead(() => T?.season, 'unknown'),
    outside: safeRead(() => V.outside, false),
  };
}

// ── Player ─────────────────────────────────────────────────

function collectPlayer(V: Record<string, any>): PlayerSnapshot {
  // Body use map
  const bodyUse: Record<string, string | number> = {};
  for (const key of BODY_USE_KEYS) {
    bodyUse[key] = safeRead(() => V[key], 0);
  }
  // Add arm/leg state
  bodyUse.leftarm = safeRead(() => V.leftarm, 0);
  bodyUse.rightarm = safeRead(() => V.rightarm, 0);
  bodyUse.leftleg = safeRead(() => V.leftleg, 0);
  bodyUse.rightleg = safeRead(() => V.rightleg, 0);

  // Body state map
  const bodyState: Record<string, string | number> = {};
  for (const key of BODY_STATE_KEYS) {
    bodyState[key] = safeRead(() => V[key], 0);
  }

  // Virginity map (true = still virgin)
  const virginity: Record<string, boolean> = {};
  for (const key of VIRGINITY_KEYS) {
    virginity[key] = safeRead(() => V.player?.virginity?.[key], false) === true;
  }

  return {
    gender: safeRead(() => V.player?.gender, 'unknown'),
    arousal: safeRead(() => V.arousal, 0),
    arousalMax: safeRead(() => V.arousalmax, 10000),
    pain: safeRead(() => V.pain, 0),
    willpowerpain: safeRead(() => V.willpowerpain, null),
    stress: safeRead(() => V.stress, 0),
    stressMax: safeRead(() => V.stressmax, 10000),
    trauma: safeRead(() => V.trauma, 0),
    traumaMax: safeRead(() => V.traumamax, 5000),
    control: safeRead(() => V.control, 1000),
    controlMax: safeRead(() => V.controlmax, 1000),
    submissive: safeRead(() => V.submissive, 1000),
    bodyUse,
    bodyState,
    virginity,
    effects: {
      dissociation: safeRead(() => V.dissociation, 0),
      trance: safeRead(() => V.trance, 0),
      possessed: safeRead(() => V.possessed, false),
      drunk: safeRead(() => V.drunk, 0),
      drugged: safeRead(() => V.drugged, 0),
      orgasmCooldown: safeRead(() => V.orgasmdown, 0),
      panicViolence: safeRead(() => V.panicviolence, 0),
      panicParalysis: safeRead(() => V.panicparalysis, 0),
    },
  };
}

// ── Combat meta ────────────────────────────────────────────

function collectCombat(V: Record<string, any>, turnIndex: number): CombatSnapshot {
  return {
    turnIndex,
    position: safeRead(() => V.position, 'unknown'),
    consensual: safeRead(() => V.consensual, 0) === 1,
    enemyType: safeRead(() => V.enemytype, 'unknown'),
    enemyCount: safeRead(() => V.enemyno, 0),
    enemyHealth: safeRead(() => V.enemyhealth, 0),
    enemyHealthMax: safeRead(() => V.enemyhealthmax, 0),
    enemyArousal: safeRead(() => V.enemyarousal, 0),
    enemyArousalMax: safeRead(() => V.enemyarousalmax, 0),
    enemyAnger: safeRead(() => V.enemyanger, 0),
    enemyAngerMax: safeRead(() => V.enemyangermax, 0),
    enemyTrust: safeRead(() => V.enemytrust, 0),
  };
}

// ── NPCs + Entity Anchor ──────────────────────────────────

function collectNpcs(
  V: Record<string, any>,
  anchor: EntityAnchorState,
): NpcSnapshot[] {
  const npcList: any[] = safeRead(() => V.NPCList, []);
  const result: NpcSnapshot[] = [];

  for (let slot = 0; slot < Math.min(npcList.length, MAX_NPC_SLOTS); slot++) {
    const npc = npcList[slot];
    if (!npc) continue;

    const isActive = safeRead(() => npc.active, null) === 'active';
    if (!isActive) continue;

    const displayName = computeDisplayName(V, npc, slot);

    // ── Entity Anchor tracking ──
    // First combat encounter for this slot → record initial name.
    if (!anchor.initialNames.has(slot)) {
      anchor.initialNames.set(slot, displayName);
    }

    const prevName = anchor.prevNames.get(slot) ?? displayName;
    let aliasHint: string | null = null;

    // Detect name change → inject alias_hint once.
    if (displayName !== prevName) {
      const switchKey = `${slot}:${prevName}->${displayName}`;
      if (!anchor.hintedSwitches.has(switchKey)) {
        aliasHint = `${prevName} -> ${displayName}`;
        anchor.hintedSwitches.add(switchKey);
      }
    }

    // Update prev for next turn.
    anchor.prevNames.set(slot, displayName);

    // ── Named NPC relationship context (§3.2.3) ──
    const namedNpcContext = collectNamedNpcContext(V, slot);

    result.push({
      npcSlot: slot,
      displayNameCurrent: displayName,
      displayNameInitial: anchor.initialNames.get(slot) ?? displayName,
      displayNamePrev: prevName,
      aliasHint,
      rawIdentity: {
        fullDescription: safeRead(() => npc.fullDescription, ''),
        description: safeRead(() => npc.description, ''),
        role: safeRead(() => npc.role, 'normal'),
        nameKnown: safeRead(() => npc.name_known, 0) === 1,
        pronoun: safeRead(() => npc.pronoun, 'n'),
        gender: safeRead(() => npc.gender, 'unknown'),
        type: safeRead(() => npc.type, 'human'),
      },
      body: {
        lefthand: safeRead(() => npc.lefthand, 0),
        righthand: safeRead(() => npc.righthand, 0),
        mouth: safeRead(() => npc.mouth, 0),
        penis: safeRead(() => npc.penis, 0),
        vagina: safeRead(() => npc.vagina, 0),
        chest: safeRead(() => npc.chest, 0),
      },
      health: safeRead(() => npc.health, 0),
      healthMax: safeRead(() => npc.healthmax, 0),
      arousal: safeRead(
        () => V[`enemyarousal${slot + 1}`],
        0,
      ),
      trust: safeRead(
        () => V[`enemytrust${slot + 1}`] ?? npc.trust,
        0,
      ),
      stance: safeRead(() => npc.stance, ''),
      insecurity: safeRead(() => npc.insecurity, ''),
      penisSize: safeRead(() => npc.penissize, 0),
      active: true,
      virginity: collectNpcVirginity(npc),
      namedNpcContext,
    });
  }

  return result;
}

/**
 * Collect persistent relationship context for a named NPC (§3.2.3).
 *
 * Uses `$npcrow` to detect whether the combat slot maps to a named NPC,
 * then reads persistent relationship data from `C.npc[name]` / `$NPCName[idx]`.
 *
 * Returns `null` for generic (randomly generated) NPCs.
 */
function collectNamedNpcContext(
  V: Record<string, any>,
  slot: number,
): NamedNpcContext | null {
  const npcRow: number[] = safeRead(() => V.npcrow, []);
  const npcNames: string[] = safeRead(() => V.npc, []);
  const namedIdx = npcRow.indexOf(slot);

  if (namedIdx < 0) return null; // Not a named NPC.

  const npcName = npcNames[namedIdx];
  if (!npcName) return null;

  // Read persistent data from C.npc (alias) or V.NPCName (direct).
  const C = getC();
  const setup = getSetup();
  const namedNpc = safeRead(() => C?.npc?.[npcName], null);

  if (!namedNpc) {
    logger.warn(`Named NPC "${npcName}" in slot ${slot} — persistent data unavailable`);
    return null;
  }

  const loveInterests: string[] = safeRead(() => setup?.loveInterestNpc, []);

  return {
    npcName,
    love: safeRead(() => namedNpc.love, 0),
    lust: safeRead(() => namedNpc.lust, 0),
    dom: safeRead(() => namedNpc.dom, 0),
    rage: safeRead(() => namedNpc.rage, 0),
    isLoveInterest: loveInterests.includes(npcName),
    loveAlias: resolveLoveAlias(setup, npcName),
  };
}

/** Collect NPC virginity map (mirrors player virginity collection). */
function collectNpcVirginity(npc: Record<string, any>): Record<string, boolean> {
  const virginity: Record<string, boolean> = {};
  for (const key of VIRGINITY_KEYS) {
    virginity[key] = safeRead(() => npc.virginity?.[key], false) === true;
  }
  return virginity;
}

/**
 * Compute the display name for an NPC in combat context.
 *
 * Mirrors the logic of the game's `<<combatperson>>` widget but uses the
 * pre-computed `fullDescription` field instead of hardcoded English template
 * words, so it works correctly with localized (e.g. Chinese) game builds.
 *
 * Decision tree (matches `<<combatperson>>`):
 * 1. Named NPC + name_known  → fullDescription (e.g. "Robin")
 * 2. Named NPC + unknown     → description (the NPC title, e.g. "pale figure")
 * 3. Generic NPC + name_known → name
 * 4. Beast                    → type (e.g. "dog")
 * 5. Otherwise                → fullDescription (already localized, e.g. "muscular man" / "阳刚男人")
 */
function computeDisplayName(
  V: Record<string, any>,
  npc: Record<string, any>,
  slot: number,
): string {
  // Check if this slot corresponds to a named NPC.
  const npcRow: number[] = safeRead(() => V.npcrow, []);
  const npcNum: number[] = safeRead(() => V.npcnum, []);
  const namedIdx = npcRow.indexOf(slot);

  if (namedIdx >= 0) {
    // This is a named NPC (has entry in $npcrow).
    const nameKnown = safeRead(() => npc.name_known, 0) === 1;
    if (nameKnown) {
      // Named NPC whose name the player knows → use fullDescription (= NPC name).
      const nameNumIdx = npcNum[namedIdx];
      const npcNameObj = safeRead(() => V.NPCName?.[nameNumIdx], null);
      if (npcNameObj?.title) {
        return String(npcNameObj.title);
      }
      return safeRead(() => npc.fullDescription, '') || 'unknown';
    }
    // Named NPC whose name the player does NOT know → use description (title-like).
    const desc = safeRead(() => {
      const idx = npcNum[namedIdx];
      return V.NPCName?.[idx]?.title;
    }, '');
    if (desc) return String(desc);
  }

  // Generic NPC whose name is known (e.g. learned mid-combat).
  if (safeRead(() => npc.name_known, 0) === 1) {
    const name = safeRead(() => npc.name, '');
    if (name) return String(name);
  }

  // Beast types → use type directly (e.g. "dog", "pig", "tentacle").
  const type = safeRead(() => npc.type, 'human');
  if (type !== 'human') {
    return String(type);
  }

  // Generic human NPC → use fullDescription (already localized by game/translation mod).
  // fullDescription = description + genderWord, set at NPC creation time.
  // e.g. "muscular man" (EN), "阳刚男人" (ZH), "slim girl" (EN), etc.
  const fullDesc = safeRead(() => npc.fullDescription, '');
  if (fullDesc) return String(fullDesc);

  // Fallback: description only.
  return safeRead(() => npc.description, 'unknown') || 'unknown';
}

// ── Clothing ───────────────────────────────────────────────

function collectClothing(V: Record<string, any>): ClothingSlotSnapshot[] {
  const result: ClothingSlotSnapshot[] = [];
  // DoL trims integrity_max from worn items at runtime (clothesDataTrimmer).
  // Use window.clothingData(slot, item, 'integrity_max') for the canonical value.
  const clothingDataFn = (window as any).clothingData as
    ((slot: string, item: any, data: string) => any) | undefined;

  for (const slot of CLOTHING_SLOTS) {
    const item = safeRead(() => V.worn?.[slot], null);
    if (!item || !item.name || item.name === 'naked') continue;

    const integrityMax = clothingDataFn
      ? safeRead(() => clothingDataFn!(slot, item, 'integrity_max'), 100)
      : safeRead(() => item.integrity_max, 100);

    result.push({
      slot,
      name: safeRead(() => item.name, ''),
      integrity: safeRead(() => item.integrity, 0),
      integrityMax: integrityMax || 100,
      state: safeRead(() => item.state, 0),
      exposed: safeRead(() => item.exposed, 0),
      vaginaExposed: safeRead(() => item.vagina_exposed, 0),
      anusExposed: safeRead(() => item.anus_exposed, 0),
    });
  }

  return result;
}
