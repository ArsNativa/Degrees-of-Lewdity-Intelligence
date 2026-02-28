/**
 * Social Tools — 社交层 (Social)
 *
 * get_npc_overview — NPC 关系摘要表
 * get_npc_detail   — 单 NPC 详情（参数化）
 *
 * All tools are read-only.
 */
import { tool, jsonSchema } from 'ai';
import { toolLogger as logger, emptyParams } from './helpers.js';
import { safeRead, getV, getC, getSetup, resolveLoveAlias } from '../access.js';
import { relationLevel } from '../semantics/index.js';

// ── get_npc_overview ────────────────────────────────────────

export const getNpcOverview = tool({
  description: [
    'Get a summary table of all named NPCs the player has met, showing name, role,',
    'and relationship levels (love, lust, dominance) as descriptive tiers.',
    'Use this to see which NPCs exist and their general standing.',
    'For detailed information about a specific NPC, call get_npc_detail with the NPC\'s name.',
  ].join(' '),
  inputSchema: emptyParams,
  execute: async () => {
    logger.info('Executing get_npc_overview');

    const V = getV();
    const C = getC();
    const setup = getSetup();

    if (!V || !setup?.NPCNameList) {
      return { _mock: true, _note: 'Game state not available' };
    }

    const nameList: string[] = setup.NPCNameList;
    const loveInterests: string[] = safeRead(() => setup.loveInterestNpc, []);

    const npcs: Array<{
      name: string;
      title: string;
      loveAlias: string;
      love: string;
      lust: string;
      dom: string;
      state: string;
    }> = [];

    for (const name of nameList) {
      const npc = safeRead(() => C?.npc?.[name] ?? V.NPCName?.[nameList.indexOf(name)], null);
      if (!npc || !npc.init) continue; // Skip NPCs not yet met

      npcs.push({
        name,
        title: safeRead(() => npc.title, '') || '',
        loveAlias: resolveLoveAlias(setup, name),
        love: relationLevel(safeRead(() => npc.love, 0)),
        lust: relationLevel(safeRead(() => npc.lust, 0)),
        dom: relationLevel(safeRead(() => npc.dom, 0)),
        state: safeRead(() => npc.state, '') || '',
      });
    }

    return {
      loveInterests,
      npcs,
      hint: 'Use get_npc_detail with npcName parameter for detailed information about a specific NPC.',
    };
  },
});

// ── get_npc_detail ──────────────────────────────────────────

const npcDetailParams = jsonSchema<{ npcName: string }>({
  type: 'object' as const,
  properties: {
    npcName: {
      type: 'string' as const,
      description: 'The name of the NPC to query, e.g. "Robin", "Sydney", "Black Wolf".',
    },
  },
  required: ['npcName'],
});

export const getNpcDetail = tool({
  description: [
    'Get detailed information about a specific named NPC, including appearance,',
    'relationship values, state, date count, and NPC-specific data (schedule, quests, etc.).',
    'You must provide the exact NPC name (e.g. "Robin", "Sydney", "Black Wolf").',
    'Call get_npc_overview first if you are unsure of the name.',
  ].join(' '),
  inputSchema: npcDetailParams,
  execute: async ({ npcName }) => {
    logger.info(`Executing get_npc_detail for "${npcName}"`);

    const V = getV();
    const C = getC();
    const setup = getSetup();

    if (!V || !setup?.NPCNameList) {
      return { error: 'Game state not available' };
    }

    const nameList: string[] = setup.NPCNameList;
    const idx = nameList.indexOf(npcName);
    if (idx === -1) {
      return { error: `NPC "${npcName}" not found. Valid names: ${nameList.join(', ')}` };
    }

    const npc = safeRead(() => C?.npc?.[npcName] ?? V.NPCName?.[idx], null);
    if (!npc) {
      return { error: `NPC "${npcName}" data not available` };
    }
    if (!npc.init) {
      return { error: `Player has not met "${npcName}" yet` };
    }

    const loveInterests: string[] = safeRead(() => setup.loveInterestNpc, []);

    // NPC-specific extra data
    const extra = buildNpcExtra(V, npcName);

    // Schedule (for NPCs that have schedule functions)
    let schedule: string | null = null;
    try {
      if (npcName === 'Sydney') {
        (window as any)?.sydneySchedule?.();
        schedule = safeRead(() => (window as any)?.T?.sydney_location, null);
      } else if (npcName === 'Avery') {
        (window as any)?.averySchedule?.();
        schedule = safeRead(() => (window as any)?.T?.avery_available, null);
      } else if (npcName === 'Gwylan') {
        (window as any)?.gwylanSchedule?.();
        schedule = safeRead(() => (window as any)?.T?.gwylan_location, null);
      }
    } catch {
      // Schedule functions may not be available
    }

    return {
      name: npcName,
      title: safeRead(() => npc.title, ''),
      gender: safeRead(() => npc.gender, 'unknown'),
      pronoun: safeRead(() => npc.pronoun, 'unknown'),
      appearance: {
        skinColour: safeRead(() => npc.skincolour, 'unknown'),
        eyeColour: safeRead(() => npc.eyeColour, 'unknown'),
        hairColour: safeRead(() => npc.hairColour, 'unknown'),
        breastSize: safeRead(() => npc.breastsize, 0),
        penisSize: safeRead(() => npc.penissize, 0),
      },
      relationship: {
        love:  { value: safeRead(() => npc.love, 0),  level: relationLevel(safeRead(() => npc.love, 0)) },
        lust:  { value: safeRead(() => npc.lust, 0),  level: relationLevel(safeRead(() => npc.lust, 0)) },
        dom:   { value: safeRead(() => npc.dom, 0),   level: relationLevel(safeRead(() => npc.dom, 0)) },
        rage:  { value: safeRead(() => npc.rage, 0),  level: relationLevel(safeRead(() => npc.rage, 0)) },
        trust: { value: safeRead(() => npc.trust, 0), level: relationLevel(safeRead(() => npc.trust, 0)) },
      },
      state: safeRead(() => npc.state, ''),
      isLoveInterest: loveInterests.includes(npcName),
      loveAlias: resolveLoveAlias(setup, npcName),
      dateCount: safeRead(() => V.dateCount?.[npcName], 0),
      extra,
      schedule,
    };
  },
});

// ── Internal: NPC-specific extra fields ─────────────────────

function buildNpcExtra(V: Record<string, any>, name: string): Record<string, any> {
  const extra: Record<string, any> = {};

  switch (name) {
    case 'Robin':
      extra.timer = safeRead(() => V.robin?.timer, null);
      extra.hurtReason = safeRead(() => V.robin?.hurtReason, null);
      extra.moneyModifier = safeRead(() => V.robin?.moneyModifier, null);
      break;
    case 'Whitney':
      extra.gang = safeRead(() => V.whitney?.gang, null);
      break;
    case 'Sydney': {
      const sydneySetup = getSetup();
      const sydneyIdx = sydneySetup?.NPCNameList?.indexOf('Sydney') ?? -1;
      extra.purity = sydneyIdx >= 0 ? safeRead(() => V.NPCName?.[sydneyIdx]?.purity, null) : null;
      extra.corruption = sydneyIdx >= 0 ? safeRead(() => V.NPCName?.[sydneyIdx]?.corruption, null) : null;
      break;
    }
    case 'Kylar':
      extra.raped = safeRead(() => V.kylar?.raped, null);
      extra.riddle = safeRead(() => V.kylar?.riddle, null);
      extra.fameStage = safeRead(() => V.kylar?.fameStage, null);
      break;
    case 'Eden':
      extra.freedom = safeRead(() => V.edenfreedom, null);
      extra.days = safeRead(() => V.edendays, null);
      break;
    case 'Avery':
      extra.mansion = safeRead(() => V.avery_mansion != null, false);
      extra.mansionSchedule = safeRead(() => V.avery_mansion?.schedule, null);
      break;
    case 'Alex':
      extra.farmStage = safeRead(() => V.farm_stage, null);
      break;
    case 'Gwylan':
      extra.progress = safeRead(() => V.gwylan?.progress, null);
      break;
  }

  return extra;
}
