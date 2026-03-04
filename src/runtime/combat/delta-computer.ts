/**
 * DeltaComputer — computes state delta between two consecutive snapshots (§3.3.1 step 2).
 *
 * Takes a previous and current StateSnapshot and produces a DeltaSnapshot
 * capturing all meaningful changes. This always works reliably regardless
 * of when it's called, because it compares stored snapshots rather than
 * reading live transient variables.
 */
import type {
  StateSnapshot,
  DeltaSnapshot,
  FieldChange,
  ClothingChange,
} from './types.js';

/**
 * Compute the delta between two consecutive state snapshots.
 *
 * @param prev  Previous turn's state snapshot.
 * @param curr  Current turn's state snapshot.
 * @returns     DeltaSnapshot describing all meaningful changes.
 */
export function computeDelta(prev: StateSnapshot, curr: StateSnapshot): DeltaSnapshot {
  return {
    // ── Numeric deltas ──
    arousalDelta: curr.player.arousal - prev.player.arousal,
    painDelta: curr.player.pain - prev.player.pain,
    stressDelta: curr.player.stress - prev.player.stress,
    traumaDelta: curr.player.trauma - prev.player.trauma,
    controlDelta: curr.player.control - prev.player.control,

    // ── Enemy aggregate deltas ──
    enemyHealthDelta: curr.combat.enemyHealth - prev.combat.enemyHealth,
    enemyArousalDelta: curr.combat.enemyArousal - prev.combat.enemyArousal,
    enemyAngerDelta: curr.combat.enemyAnger - prev.combat.enemyAnger,
    enemyTrustDelta: curr.combat.enemyTrust - prev.combat.enemyTrust,

    // ── Structured diffs ──
    bodyUseChanges: diffRecord(prev.player.bodyUse, curr.player.bodyUse),
    bodyStateChanges: diffRecord(prev.player.bodyState, curr.player.bodyState),
    playerVirginityLost: diffVirginityLoss(prev.player.virginity, curr.player.virginity),
    npcVirginityLost: diffNpcVirginityLoss(prev.npcs, curr.npcs),
    clothingChanges: diffClothing(prev.clothing, curr.clothing),
    npcBodyChanges: diffNpcBodies(prev.npcs, curr.npcs),
    positionChange: diffScalar(prev.combat.position, curr.combat.position),
    consensualChange: diffScalar(prev.combat.consensual, curr.combat.consensual),
    nameChanges: diffNpcNames(prev.npcs, curr.npcs),

    // ── Orgasm signals ──
    ...computeOrgasmSignals(prev, curr),
  };
}

// ── Diff helpers ───────────────────────────────────────────

/** Diff two flat records, returning fields that changed. */
function diffRecord(
  prev: Record<string, any>,
  curr: Record<string, any>,
): FieldChange[] {
  const changes: FieldChange[] = [];
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)]);
  for (const key of allKeys) {
    if (prev[key] !== curr[key]) {
      changes.push({ field: key, from: prev[key], to: curr[key] });
    }
  }
  return changes;
}

/**
 * Detect virginity loss: fields that changed from `true` to non-`true`.
 * Uses strict `=== true` as required by §3.3.3.
 */
function diffVirginityLoss(
  prev: Record<string, boolean>,
  curr: Record<string, boolean>,
): string[] {
  const lost: string[] = [];
  for (const key of Object.keys(prev)) {
    if (prev[key] === true && curr[key] !== true) {
      lost.push(key);
    }
  }
  return lost;
}

/**
 * Detect NPC virginity loss across all NPC slots.
 * Matches NPCs by npcSlot for stable identity.
 */
function diffNpcVirginityLoss(
  prevNpcs: { npcSlot: number; virginity: Record<string, boolean> }[],
  currNpcs: { npcSlot: number; virginity: Record<string, boolean> }[],
): { npcSlot: number; type: string }[] {
  const result: { npcSlot: number; type: string }[] = [];
  const currMap = new Map(currNpcs.map(n => [n.npcSlot, n]));

  for (const prev of prevNpcs) {
    const curr = currMap.get(prev.npcSlot);
    if (!curr) continue;
    for (const key of Object.keys(prev.virginity)) {
      if (prev.virginity[key] === true && curr.virginity[key] !== true) {
        result.push({ npcSlot: prev.npcSlot, type: key });
      }
    }
  }
  return result;
}

/** Diff clothing arrays — match by slot name. */
function diffClothing(
  prevItems: { slot: string; name: string; integrity: number; integrityMax: number; state: string | number; exposed: number; vaginaExposed: number; anusExposed: number }[],
  currItems: { slot: string; name: string; integrity: number; integrityMax: number; state: string | number; exposed: number; vaginaExposed: number; anusExposed: number }[],
): ClothingChange[] {
  const changes: ClothingChange[] = [];
  const prevMap = new Map(prevItems.map(c => [c.slot, c]));
  const currMap = new Map(currItems.map(c => [c.slot, c]));

  const allSlots = new Set([...prevMap.keys(), ...currMap.keys()]);
  for (const slot of allSlots) {
    const p = prevMap.get(slot);
    const c = currMap.get(slot);

    if (!p && c) {
      // Item appeared (equipped or restored)
      changes.push({ slot, field: 'name', from: 'naked', to: c.name });
    } else if (p && !c) {
      // Item disappeared (removed or destroyed)
      changes.push({ slot, field: 'name', from: p.name, to: 'naked' });
    } else if (p && c) {
      // Both exist — diff individual fields
      const DIFF_FIELDS = ['name', 'integrity', 'state', 'exposed', 'vaginaExposed', 'anusExposed'] as const;
      for (const f of DIFF_FIELDS) {
        if ((p as any)[f] !== (c as any)[f]) {
          changes.push({ slot, field: f, from: (p as any)[f], to: (c as any)[f] });
        }
      }
    }
  }
  return changes;
}

/** Diff NPC body-targeting fields across slots. */
function diffNpcBodies(
  prevNpcs: { npcSlot: number; body: Record<string, any> }[],
  currNpcs: { npcSlot: number; body: Record<string, any> }[],
): { npcSlot: number; field: string; from: any; to: any }[] {
  const result: { npcSlot: number; field: string; from: any; to: any }[] = [];
  const currMap = new Map(currNpcs.map(n => [n.npcSlot, n]));

  for (const prev of prevNpcs) {
    const curr = currMap.get(prev.npcSlot);
    if (!curr) continue;
    for (const field of Object.keys(prev.body)) {
      if (prev.body[field] !== curr.body[field]) {
        result.push({
          npcSlot: prev.npcSlot,
          field,
          from: prev.body[field],
          to: curr.body[field],
        });
      }
    }
  }
  return result;
}

/** Diff NPC display names. */
function diffNpcNames(
  prevNpcs: { npcSlot: number; displayNameCurrent: string }[],
  currNpcs: { npcSlot: number; displayNameCurrent: string }[],
): { npcSlot: number; from: string; to: string }[] {
  const result: { npcSlot: number; from: string; to: string }[] = [];
  const currMap = new Map(currNpcs.map(n => [n.npcSlot, n]));

  for (const prev of prevNpcs) {
    const curr = currMap.get(prev.npcSlot);
    if (!curr) continue;
    if (prev.displayNameCurrent !== curr.displayNameCurrent) {
      result.push({
        npcSlot: prev.npcSlot,
        from: prev.displayNameCurrent,
        to: curr.displayNameCurrent,
      });
    }
  }
  return result;
}

/** Diff a scalar value; returns null if unchanged. */
function diffScalar<T>(prev: T, curr: T): { from: T; to: T } | null {
  return prev !== curr ? { from: prev, to: curr } : null;
}

/**
 * Compute orgasm trigger signals.
 *
 * Primary signal: `orgasmCount` increased (driven by `<<orgasm>>` widget
 * which increments `$orgasmcount` — see orgasm.twee L3).
 *
 * Fallback: `orgasmCooldown` transitioned from <=0 to >=1 AND arousal
 * dropped significantly (>= 2000) — guards against false positives from
 * non-orgasm cooldown writes.
 */
function computeOrgasmSignals(
  prev: StateSnapshot,
  curr: StateSnapshot,
): Pick<DeltaSnapshot, 'playerOrgasmTriggered' | 'orgasmCountDelta'> {
  const orgasmCountDelta = curr.player.orgasmCount - prev.player.orgasmCount;

  // Primary: orgasmCount increased this turn.
  if (orgasmCountDelta > 0) {
    return { playerOrgasmTriggered: true, orgasmCountDelta };
  }

  // Fallback: cooldown edge (0→≥1) + large arousal drop.
  const cooldownEdge =
    prev.player.effects.orgasmCooldown <= 0 &&
    curr.player.effects.orgasmCooldown >= 1;
  const arousalDrop = prev.player.arousal - curr.player.arousal;

  if (cooldownEdge && arousalDrop >= 2000) {
    return { playerOrgasmTriggered: true, orgasmCountDelta: 1 };
  }

  return { playerOrgasmTriggered: false, orgasmCountDelta: 0 };
}
