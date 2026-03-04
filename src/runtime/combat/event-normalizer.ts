/**
 * EventNormalizer — normalizes intent + delta into a structured MechanismEvent list (§3.3).
 *
 * Rules are organized by the 10 event dimensions defined in §3.3.2, evaluated
 * in priority order:
 *   1. milestone   — virginity loss, vow break (§3.3.3)
 *   2. orgasm      — player orgasm triggered
 *   3. control     — control gain/loss/shift
 *   4. consent     — consensual state change
 *   5. contact     — body-part engagement/disengagement
 *   6. penetration — bodyState penetration changes
 *   7. clothing    — exposure/displacement/damage
 *   8. boundary_request — askAction requests (§3.3.5)
 *   9. humiliation — mock/disparage (§3.3.4)
 *  10. name_alias_switch — NPC display name change
 *
 * Each rule produces zero or more MechanismEvent entries. All matching rules
 * fire (no short-circuit), and the final list is sorted by priority.
 */
import type { ExtractionContext, MechanismEvent } from './types.js';

/** Priority constants — lower number = higher priority. */
const PRIORITY = {
  MILESTONE: 1,
  ORGASM: 2,
  CONTROL: 3,
  CONSENT: 4,
  CONTACT: 5,
  PENETRATION: 6,
  CLOTHING: 7,
  BOUNDARY_REQUEST: 8,
  HUMILIATION: 9,
  NAME_ALIAS_SWITCH: 10,
} as const;

/**
 * Normalize an extraction context into a sorted list of mechanism events.
 */
export function normalizeEvents(ctx: ExtractionContext): MechanismEvent[] {
  const events: MechanismEvent[] = [];

  // Run all rule dimensions.
  extractMilestoneEvents(ctx, events);
  extractOrgasmEvents(ctx, events);
  extractControlEvents(ctx, events);
  extractConsentEvents(ctx, events);
  extractContactEvents(ctx, events);
  extractPenetrationEvents(ctx, events);
  extractClothingEvents(ctx, events);
  extractBoundaryRequestEvents(ctx, events);
  extractHumiliationEvents(ctx, events);
  extractNameAliasEvents(ctx, events);

  // Sort by priority (stable sort preserves insertion order within same priority).
  events.sort((a, b) => a.priority - b.priority);

  return events;
}

// ── 1. Milestone (§3.3.3) ──────────────────────────────────

function extractMilestoneEvents(ctx: ExtractionContext, out: MechanismEvent[]): void {
  const { delta, prevState, currState } = ctx;

  // Player virginity loss
  for (const type of delta.playerVirginityLost) {
    const eventType = type === 'temple'
      ? 'milestone.temple_vow_break'
      : `milestone.virginity_loss`;

    out.push({
      eventType,
      actorSlot: null,
      targetSlot: -1, // player
      intent: {},
      delta: { virginityType: type, from: true, to: false },
      outcome: 'observed',
      evidence: [`player.virginity.${type}`],
      provenance: 'virginity_diff',
      priority: PRIORITY.MILESTONE,
    });
  }

  // NPC virginity loss
  for (const { npcSlot, type } of delta.npcVirginityLost) {
    out.push({
      eventType: 'milestone.npc_virginity_loss',
      actorSlot: -1, // player is actor
      targetSlot: npcSlot,
      intent: {},
      delta: { virginityType: type, npcSlot, from: true, to: false },
      outcome: 'observed',
      evidence: [`npc[${npcSlot}].virginity.${type}`],
      provenance: 'virginity_diff',
      priority: PRIORITY.MILESTONE,
    });
  }
}

// ── 2. Orgasm ──────────────────────────────────────────────

/**
 * Detects player orgasm events.
 *
 * Primary signal: `orgasmCount` increased (set by `<<orgasm>>` widget in
 * orgasm.twee). Fallback: `orgasmCooldown` edge 0→≥1 + large arousal drop.
 *
 * Effects in game: orgasmCooldown set to 3, arousal drops 3000–10000+,
 * player actions disabled for cooldown turns, stress reduced by 200.
 */
function extractOrgasmEvents(ctx: ExtractionContext, out: MechanismEvent[]): void {
  const { delta, currState } = ctx;

  if (!delta.playerOrgasmTriggered) return;

  out.push({
    eventType: 'orgasm.player',
    actorSlot: -1,
    targetSlot: null,
    intent: {},
    delta: {
      orgasmCountDelta: delta.orgasmCountDelta,
      orgasmCount: currState.player.orgasmCount,
      orgasmCooldown: currState.player.effects.orgasmCooldown,
      arousalDelta: delta.arousalDelta,
    },
    outcome: 'observed',
    evidence: ['player.orgasmCount', 'player.effects.orgasmCooldown', 'arousalDelta'],
    provenance: 'orgasm_diff',
    priority: PRIORITY.ORGASM,
  });
}

// ── 3. Control ─────────────────────────────────────────────

/** Threshold for control delta to be considered significant. */
const CONTROL_THRESHOLD = 20;

function extractControlEvents(ctx: ExtractionContext, out: MechanismEvent[]): void {
  const { delta } = ctx;

  if (Math.abs(delta.controlDelta) >= CONTROL_THRESHOLD) {
    const direction = delta.controlDelta > 0 ? 'gain' : 'loss';
    out.push({
      eventType: `control.${direction}`,
      actorSlot: -1,
      targetSlot: null,
      intent: {},
      delta: { controlDelta: delta.controlDelta },
      outcome: 'observed',
      evidence: ['player.control'],
      provenance: 'control_diff',
      priority: PRIORITY.CONTROL,
    });
  }
}

// ── 4. Consent ─────────────────────────────────────────────

function extractConsentEvents(ctx: ExtractionContext, out: MechanismEvent[]): void {
  const { delta } = ctx;

  if (delta.consensualChange) {
    const direction = delta.consensualChange.to ? 'to_consensual' : 'to_nonconsensual';
    out.push({
      eventType: `consent.${direction}`,
      actorSlot: null,
      targetSlot: null,
      intent: {},
      delta: { from: delta.consensualChange.from, to: delta.consensualChange.to },
      outcome: 'observed',
      evidence: ['combat.consensual'],
      provenance: 'consensual_diff',
      priority: PRIORITY.CONSENT,
    });
  }
}

// ── 5. Contact ─────────────────────────────────────────────

/**
 * Body-part use values that indicate engagement (non-idle).
 * In DoL, 0 = free/idle; any non-zero string or number means occupied.
 */
function isEngaged(value: any): boolean {
  return value !== 0 && value !== '' && value !== 'rest' && value != null;
}

function extractContactEvents(ctx: ExtractionContext, out: MechanismEvent[]): void {
  const { delta } = ctx;

  // Player body-use changes
  for (const change of delta.bodyUseChanges) {
    const wasEngaged = isEngaged(change.from);
    const nowEngaged = isEngaged(change.to);

    if (!wasEngaged && nowEngaged) {
      out.push({
        eventType: 'contact.engage',
        actorSlot: null,
        targetSlot: -1,
        intent: {},
        delta: { bodyPart: change.field, from: change.from, to: change.to },
        outcome: 'observed',
        evidence: [`player.bodyUse.${change.field}`],
        provenance: 'bodyuse_diff',
        priority: PRIORITY.CONTACT,
      });
    } else if (wasEngaged && !nowEngaged) {
      out.push({
        eventType: 'contact.disengage',
        actorSlot: null,
        targetSlot: -1,
        intent: {},
        delta: { bodyPart: change.field, from: change.from, to: change.to },
        outcome: 'observed',
        evidence: [`player.bodyUse.${change.field}`],
        provenance: 'bodyuse_diff',
        priority: PRIORITY.CONTACT,
      });
    } else if (wasEngaged && nowEngaged && change.from !== change.to) {
      // Switched engagement (e.g. from one NPC to another)
      out.push({
        eventType: 'contact.switch',
        actorSlot: null,
        targetSlot: -1,
        intent: {},
        delta: { bodyPart: change.field, from: change.from, to: change.to },
        outcome: 'observed',
        evidence: [`player.bodyUse.${change.field}`],
        provenance: 'bodyuse_diff',
        priority: PRIORITY.CONTACT,
      });
    }
  }

  // NPC body-targeting changes (NPC hands/mouth on player)
  for (const change of delta.npcBodyChanges) {
    const wasEngaged = isEngaged(change.from);
    const nowEngaged = isEngaged(change.to);

    if (!wasEngaged && nowEngaged) {
      out.push({
        eventType: 'contact.npc_engage',
        actorSlot: change.npcSlot,
        targetSlot: -1,
        intent: {},
        delta: { bodyPart: change.field, from: change.from, to: change.to },
        outcome: 'observed',
        evidence: [`npc[${change.npcSlot}].body.${change.field}`],
        provenance: 'npcbody_diff',
        priority: PRIORITY.CONTACT,
      });
    } else if (wasEngaged && !nowEngaged) {
      out.push({
        eventType: 'contact.npc_disengage',
        actorSlot: change.npcSlot,
        targetSlot: -1,
        intent: {},
        delta: { bodyPart: change.field, from: change.from, to: change.to },
        outcome: 'observed',
        evidence: [`npc[${change.npcSlot}].body.${change.field}`],
        provenance: 'npcbody_diff',
        priority: PRIORITY.CONTACT,
      });
    }
  }
}

// ── 6. Penetration ─────────────────────────────────────────

type PenetrationPhase = 'none' | 'entrance' | 'imminent' | 'penetrated';

const PENETRATION_PHASE_RANK: Record<PenetrationPhase, number> = {
  none: 0,
  entrance: 1,
  imminent: 2,
  penetrated: 3,
};

/**
 * Classify DoL body-state strings into coarse penetration phases.
 *
 * Uses suffix-style heuristics (`*entrance`, `*imminent`, `*penetrated`)
 * plus a conservative fallback for long-tail "other*" / "tentacle*" states.
 */
function classifyPenetrationPhase(raw: any): PenetrationPhase {
  if (raw === 0 || raw == null) return 'none';

  const value = String(raw).trim().toLowerCase();
  if (!value || value === '0' || value === 'none' || value === 'rest') return 'none';

  // Explicitly keep kiss states out of penetration semantics.
  if (value.includes('kiss')) return 'none';

  if (value.includes('entrance')) return 'entrance';
  if (value.includes('imminent')) return 'imminent';
  if (value.includes('penetrated') || value.includes('penetrating')) return 'penetrated';

  // Cover common ongoing states without explicit suffixes.
  if (
    value.startsWith('other') ||
    value.includes('tentacle') ||
    value === 'penis' ||
    value === 'vagina' ||
    value === 'anus' ||
    value === 'mouth'
  ) {
    // Non-penetrative body contact: rub, thigh/cheek friction, feet.
    if (
      value.includes('rub') ||
      value.includes('thigh') ||
      value.includes('cheek') ||
      value.includes('feet')
    ) return 'none';
    return 'penetrated';
  }

  return 'none';
}

function extractPenetrationEvents(ctx: ExtractionContext, out: MechanismEvent[]): void {
  const { delta } = ctx;

  for (const change of delta.bodyStateChanges) {
    const prevPhase = classifyPenetrationPhase(change.from);
    const currPhase = classifyPenetrationPhase(change.to);

    if (prevPhase === 'none' && currPhase !== 'none') {
      out.push({
        eventType: 'penetration.start',
        actorSlot: null,
        targetSlot: -1,
        intent: {},
        delta: {
          bodyPart: change.field,
          from: change.from,
          to: change.to,
          fromPhase: prevPhase,
          toPhase: currPhase,
        },
        outcome: 'observed',
        evidence: [`player.bodyState.${change.field}`],
        provenance: 'bodystate_diff',
        priority: PRIORITY.PENETRATION,
      });
    } else if (prevPhase !== 'none' && currPhase === 'none') {
      out.push({
        eventType: 'penetration.end',
        actorSlot: null,
        targetSlot: -1,
        intent: {},
        delta: {
          bodyPart: change.field,
          from: change.from,
          to: change.to,
          fromPhase: prevPhase,
          toPhase: currPhase,
        },
        outcome: 'observed',
        evidence: [`player.bodyState.${change.field}`],
        provenance: 'bodystate_diff',
        priority: PRIORITY.PENETRATION,
      });
    } else if (prevPhase !== 'none' && currPhase !== 'none' && change.from !== change.to) {
      const prevRank = PENETRATION_PHASE_RANK[prevPhase];
      const currRank = PENETRATION_PHASE_RANK[currPhase];
      const eventType = currRank > prevRank
        ? 'penetration.intensify'
        : 'penetration.switch';

      out.push({
        eventType,
        actorSlot: null,
        targetSlot: -1,
        intent: {},
        delta: {
          bodyPart: change.field,
          from: change.from,
          to: change.to,
          fromPhase: prevPhase,
          toPhase: currPhase,
        },
        outcome: 'observed',
        evidence: [`player.bodyState.${change.field}`],
        provenance: 'bodystate_diff',
        priority: PRIORITY.PENETRATION,
      });
    }
  }
}

// ── 7. Clothing ────────────────────────────────────────────

function extractClothingEvents(ctx: ExtractionContext, out: MechanismEvent[]): void {
  const { delta } = ctx;

  for (const change of delta.clothingChanges) {
    let subType: string;
    if (change.field === 'name') {
      // Item changed or removed/equipped
      subType = change.to === 'naked' ? 'remove' : change.from === 'naked' ? 'equip' : 'swap';
    } else if (change.field === 'exposed' || change.field === 'vaginaExposed' || change.field === 'anusExposed') {
      subType = 'expose';
    } else if (change.field === 'integrity') {
      subType = (change.to as number) < (change.from as number) ? 'damage' : 'repair';
    } else if (change.field === 'state') {
      subType = 'displace';
    } else {
      subType = 'change';
    }

    out.push({
      eventType: `clothing.${subType}`,
      actorSlot: null,
      targetSlot: -1,
      intent: {},
      delta: { slot: change.slot, field: change.field, from: change.from, to: change.to },
      outcome: 'observed',
      evidence: [`worn.${change.slot}.${change.field}`],
      provenance: 'clothing_diff',
      priority: PRIORITY.CLOTHING,
    });
  }
}

// ── 8. Boundary Request (§3.3.5) ───────────────────────────

const SAFETY_ASK_ACTIONS = new Set([
  'condoms',
  'noCondoms',
  'askPullOut',
]);

function classifyBoundaryRequestType(askAction: string): string {
  if (SAFETY_ASK_ACTIONS.has(askAction)) return 'safety';
  if (askAction === 'finish') return 'stop';
  if (askAction.startsWith('no')) return 'refuse';
  if (askAction.startsWith('ask')) return 'request_more';
  return 'other';
}

/**
 * Extracts boundary_request events from the askAction intent.
 * Fires only when player actually selected "Ask" this turn.
 */
function extractBoundaryRequestEvents(ctx: ExtractionContext, out: MechanismEvent[]): void {
  const { intent } = ctx;
  const mouthaction = intent.mouthaction;
  if (mouthaction !== 'ask') return;

  const askAction = intent.askAction;
  if (typeof askAction !== 'string' || !askAction || askAction === 'rest') return;

  const requestType = classifyBoundaryRequestType(askAction);
  const mouthtargetSlot = typeof intent.mouthtarget === 'number' ? intent.mouthtarget : null;

  out.push({
    eventType: `boundary_request.${requestType}`,
    actorSlot: -1,
    targetSlot: mouthtargetSlot,
    intent: { mouthaction, askAction, mouthtarget: intent.mouthtarget },
    delta: {},
    outcome: 'observed',
    evidence: ['mouthaction', 'askAction'],
    provenance: 'intent_askaction',
    priority: PRIORITY.BOUNDARY_REQUEST,
  });
}

// ── 9. Humiliation / Mock (§3.3.4) ─────────────────────────

function extractHumiliationEvents(ctx: ExtractionContext, out: MechanismEvent[]): void {
  const { intent, currState, delta } = ctx;

  const mouthaction = intent.mouthaction;
  if (mouthaction !== 'mock' && mouthaction !== 'disparage') return;

  const mockaction = intent.mockaction;
  const mouthtarget = intent.mouthtarget;
  const mouthtargetSlot = typeof mouthtarget === 'number' ? mouthtarget : null;

  // Try to match against targeted NPC's insecurity.
  const targetNpc = mouthtargetSlot === null
    ? undefined
    : currState.npcs.find(n => n.npcSlot === mouthtargetSlot);
  const insecurity = targetNpc?.insecurity ?? '';
  const isHit = mockaction !== 0 && String(mockaction) === insecurity;

  out.push({
    eventType: `humiliation.${String(mouthaction)}`,
    actorSlot: -1,
    targetSlot: mouthtargetSlot,
    intent: { mouthaction, mockaction, mouthtarget },
    delta: {
      controlDelta: delta.controlDelta,
      insecurityMatch: isHit,
    },
    outcome: isHit ? 'hit' : 'miss',
    evidence: ['mouthaction', 'mockaction', 'npc.insecurity', 'control_delta'],
    provenance: 'intent_mock',
    priority: PRIORITY.HUMILIATION,
  });
}

// ── 10. Name Alias Switch ──────────────────────────────────

function extractNameAliasEvents(ctx: ExtractionContext, out: MechanismEvent[]): void {
  const { delta } = ctx;

  for (const change of delta.nameChanges) {
    out.push({
      eventType: 'name_alias_switch',
      actorSlot: null,
      targetSlot: change.npcSlot,
      intent: {},
      delta: { from: change.from, to: change.to },
      outcome: 'observed',
      evidence: [`npc[${change.npcSlot}].displayNameCurrent`],
      provenance: 'name_diff',
      priority: PRIORITY.NAME_ALIAS_SWITCH,
    });
  }
}
