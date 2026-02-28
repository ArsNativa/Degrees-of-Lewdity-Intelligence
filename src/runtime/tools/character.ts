/**
 * Character Tools — 角色状态层 (Character)
 *
 * get_player_status     — 核心数值条/金钱/危险指标
 * get_skills            — 技能等级与学业成绩
 * get_clothing_appearance — 穿着/外观/变身
 * get_fame_reputation   — 声望/犯罪/社会评价
 *
 * All tools are read-only.
 */
import { tool } from 'ai';
import { toolLogger as logger, emptyParams } from './helpers.js';
import { safeRead, getV } from '../access.js';
import {
  skillGrade,
  detailedSkillGrade,
  subjectGrade,
  traumaLevel,
  stressLevel,
  arousalLevel,
  controlLevel,
  fatigueLevel,
  hungerLevel,
  painLevel,
  fameLevel,
  policeStatusLabel,
  delinquencyLabel,
  coolLabel,
  orphanageMood,
  breastSizeDesc,
  penisSizeDesc,
  bottomSizeDesc,
  genderLabel,
  integrityLabel,
  submissiveLevel,
  formatMoney,
} from '../semantics/index.js';

// ── get_player_status ───────────────────────────────────────

export const getPlayerStatus = tool({
  description: [
    'Get the player character\'s core status dashboard including mental bars',
    '(trauma, stress, control), physical bars (pain, arousal, tiredness, hunger),',
    'money, willpower, physique, beauty, and active status effects.',
    'Use this when the user asks about their character state, how they are doing,',
    'or when you need general context about the player.',
    'For detailed skills use get_skills; for clothing/appearance use get_clothing_appearance.',
  ].join(' '),
  inputSchema: emptyParams,
  execute: async () => {
    logger.info('Executing get_player_status');

    const V = getV();
    if (!V) {
      return { _mock: true, _note: 'Game state not available' };
    }

    const traumaMax = safeRead(() => V.traumamax, 5000);
    const stressMax = safeRead(() => V.stressmax, 10000);
    const arousalMax = safeRead(() => V.arousalmax, 10000);
    const controlMax = safeRead(() => V.controlmax, 1000);
    const physiqueMax = safeRead(() => V.physiquemax, 20000);
    const willpowerMax = safeRead(() => V.willpowermax, 1000);
    const beautyMax = safeRead(() => V.beautymax, 10000);

    const trauma = safeRead(() => V.trauma, 0);
    const stress = safeRead(() => V.stress, 0);
    const arousal = safeRead(() => V.arousal, 0);
    const control = safeRead(() => V.control, 1000);
    const pain = safeRead(() => V.pain, 0);
    const tiredness = safeRead(() => V.tiredness, 0);
    const hunger = safeRead(() => V.hunger, 0);

    // Mental conditions
    const mentalConditions: string[] = [];
    if (safeRead(() => V.nightmares, 0)) mentalConditions.push('nightmares');
    if (safeRead(() => V.anxiety, 0) >= 2) mentalConditions.push('severe_anxiety');
    else if (safeRead(() => V.anxiety, 0) >= 1) mentalConditions.push('anxiety');
    if (safeRead(() => V.flashbacks, 0)) mentalConditions.push('flashbacks');
    if (safeRead(() => V.panicattacks, 0) >= 2) mentalConditions.push('severe_panic_attacks');
    else if (safeRead(() => V.panicattacks, 0) >= 1) mentalConditions.push('panic_attacks');
    if (safeRead(() => V.hallucinations, 0) >= 2) mentalConditions.push('severe_hallucinations');
    else if (safeRead(() => V.hallucinations, 0) >= 1) mentalConditions.push('hallucinations');
    if (safeRead(() => V.dissociation, 0)) mentalConditions.push('dissociation');

    return {
      name: safeRead(() => V.saveName, '') || 'Unknown',
      gender: genderLabel(safeRead(() => V.player?.gender, 'unknown')),
      sex: safeRead(() => V.player?.sex, 'unknown'),
      money: formatMoney(safeRead(() => V.money, 0)),
      trauma:    { value: trauma, max: traumaMax, level: traumaLevel(trauma, traumaMax) },
      stress:    { value: stress, max: stressMax, level: stressLevel(stress, stressMax) },
      arousal:   { value: arousal, max: arousalMax, level: arousalLevel(arousal, arousalMax) },
      pain:      { value: pain, level: painLevel(pain) },
      tiredness: { value: tiredness, level: fatigueLevel(tiredness) },
      hunger:    { value: hunger, level: hungerLevel(hunger) },
      control:   { value: control, max: controlMax, level: controlLevel(control, controlMax, safeRead(() => V.possessed, false)) },
      physique:  { value: safeRead(() => V.physique, 0), max: physiqueMax },
      willpower: { value: safeRead(() => V.willpower, 0), max: willpowerMax },
      beauty:    { value: safeRead(() => V.beauty, 0), max: beautyMax },
      purity: safeRead(() => V.purity, 0),
      awareness: safeRead(() => V.awareness, 0),
      submissive: { value: safeRead(() => V.submissive, 1000), level: submissiveLevel(safeRead(() => V.submissive, 1000)) },
      effects: {
        drunk: safeRead(() => V.drunk, 0),
        drugged: safeRead(() => V.drugged, 0),
        hallucinogen: safeRead(() => V.hallucinogen, 0),
        mentalConditions,
        pregnant: safeRead(() => typeof (window as any)?.playerIsPregnant === 'function'
            && (window as any).playerIsPregnant(), false),
        controlled: safeRead(() => V.controlled, 0) > 0,
      },
      combatActive: safeRead(() => V.combat, 0) === 1,
    };
  },
});

// ── get_skills ──────────────────────────────────────────────

export const getSkills = tool({
  description: [
    'Get all player skills (general and intimate), school grades, and behavioral thresholds.',
    'General skills: skulduggery, dancing, swimming, athletics, tending, housekeeping.',
    'School subjects: science, maths, english, history with grades and exam scores.',
    'Use this when the user asks about their abilities, grades, or skill levels.',
  ].join(' '),
  inputSchema: emptyParams,
  execute: async () => {
    logger.info('Executing get_skills');

    const V = getV();
    if (!V) {
      return { _mock: true, _note: 'Game state not available' };
    }

    const gs = (key: string) => {
      const v = safeRead(() => V[key], 0);
      return { value: v, grade: skillGrade(v) };
    };

    // General skills use the detailed 13-tier scale
    const dgs = (key: string) => {
      const v = safeRead(() => V[key], 0);
      return { value: v, grade: detailedSkillGrade(v) };
    };

    return {
      generalSkills: {
        skulduggery: dgs('skulduggery'),
        dancing: dgs('danceskill'),
        swimming: dgs('swimmingskill'),
        athletics: dgs('athletics'),
        tending: dgs('tending'),
        housekeeping: dgs('housekeeping'),
      },
      sexSkills: {
        seduction: gs('seductionskill'),
        oral: gs('oralskill'),
        vaginal: gs('vaginalskill'),
        anal: gs('analskill'),
        hand: gs('handskill'),
        feet: gs('feetskill'),
        penile: gs('penileskill'),
        chest: gs('chestskill'),
        thigh: gs('thighskill'),
        bottom: gs('bottomskill'),
      },
      school: {
        science: { score: safeRead(() => V.science, 0), trait: safeRead(() => V.sciencetrait, 0), star: safeRead(() => V.science_star, 0), grade: subjectGrade(safeRead(() => V.sciencetrait, 0)) },
        maths:   { score: safeRead(() => V.maths, 0),   trait: safeRead(() => V.mathstrait, 0),   star: safeRead(() => V.maths_star, 0),   grade: subjectGrade(safeRead(() => V.mathstrait, 0)) },
        english: { score: safeRead(() => V.english, 0), trait: safeRead(() => V.englishtrait, 0), star: safeRead(() => V.english_star, 0), grade: subjectGrade(safeRead(() => V.englishtrait, 0)) },
        history: { score: safeRead(() => V.history, 0), trait: safeRead(() => V.historytrait, 0), star: safeRead(() => V.history_star, 0), grade: subjectGrade(safeRead(() => V.historytrait, 0)) },
        overall: safeRead(() => V.school, 0),
        detention: safeRead(() => V.detention, 0),
        delinquency: { value: safeRead(() => V.delinquency, 0), level: delinquencyLabel(safeRead(() => V.delinquency, 0)) },
      },
      thresholds: {
        exhibitionism: safeRead(() => V.exhibitionism, 0),
        promiscuity: safeRead(() => V.promiscuity, 0),
        deviancy: safeRead(() => V.deviancy, 0),
      },
      sensitivity: {
        mouth: safeRead(() => V.mouthsensitivity, 1),
        breast: safeRead(() => V.breastsensitivity, 1),
        bottom: safeRead(() => V.bottomsensitivity, 1),
        genital: safeRead(() => V.genitalsensitivity, 1),
      },
    };
  },
});

// ── get_clothing_appearance ─────────────────────────────────

export const getClothingAppearance = tool({
  description: [
    'Get the player\'s current clothing, physical appearance, hair, body measurements,',
    'and transformation status.',
    'Use this when the user asks about what they are wearing, their appearance,',
    'or transformation progress.',
  ].join(' '),
  inputSchema: emptyParams,
  execute: async () => {
    logger.info('Executing get_clothing_appearance');

    const V = getV();
    if (!V) {
      return { _mock: true, _note: 'Game state not available' };
    }

    // Clothing — only include non-naked slots
    const clothing: Record<string, any> = {};
    const allSlots = safeRead(() => (window as any)?.SugarCube?.setup?.clothes_all_slots
        ?? (window as any)?.setup?.clothes_all_slots, null);
    const slots: string[] = allSlots ?? [
      'over_upper', 'over_lower', 'over_head',
      'upper', 'lower',
      'under_upper', 'under_lower',
      'head', 'face', 'neck', 'hands', 'handheld', 'legs', 'feet',
      'genitals',
    ];

    for (const slot of slots) {
      const item = safeRead(() => V.worn?.[slot], null);
      if (item && item.name && item.name !== 'naked') {
        // integrity_max may be trimmed from V.worn to save storage;
        // game uses clothingData(slot, item, 'integrity_max') to fall back to setup.
        const intMax = safeRead(() => {
          const cd = (window as any)?.clothingData;
          return typeof cd === 'function' ? cd(slot, item, 'integrity_max') : item.integrity_max;
        }, item.integrity_max);
        clothing[slot] = {
          name: item.name,
          colour: item.colour || undefined,
          integrity: integrityLabel(item.integrity, intMax),
          reveal: item.reveal ?? 0,
          type: item.type ?? [],
        };
      }
    }

    // Transformations — only include level ≥ 1
    const tfNames = ['angel', 'fallenangel', 'demon', 'cat', 'cow', 'harpy', 'fox', 'wolfgirl'] as const;
    const transformations: Record<string, { level: number; fullForm: boolean }> = {};
    for (const tf of tfNames) {
      const level = safeRead(() => V[tf], 0);
      if (level >= 1) {
        transformations[tf] = { level, fullForm: level >= 6 };
      }
    }

    return {
      clothing,
      exposure: {
        topless: safeRead(() => (window as any)?.T?.topless, false),
        bottomless: safeRead(() => (window as any)?.T?.bottomless, false),
        fullyNaked: safeRead(() => (window as any)?.T?.fullyNaked, false),
        genitalsExposed: safeRead(() => {
          const worn = V?.worn;
          return worn?.over_lower?.vagina_exposed >= 1
            && worn?.lower?.vagina_exposed >= 1
            && worn?.under_lower?.vagina_exposed >= 1;
        }, false),
      },
      hair: {
        length: safeRead(() => V.hairlengthstage, 'unknown'),
        colour: safeRead(() => V.haircolour, 'unknown'),
        style: safeRead(() => V.hairtype, 'default'),
      },
      body: {
        breastSize: safeRead(() => V.player?.breastsize, 0) > 0
          ? { value: V.player.breastsize, desc: breastSizeDesc(V.player.breastsize) }
          : { value: 0, desc: 'flat' },
        penisSize: safeRead(() => V.player?.penisExist, false)
          ? { value: safeRead(() => V.player.penissize, 0), desc: penisSizeDesc(safeRead(() => V.player.penissize, 0)) }
          : null,
        vaginaExist: safeRead(() => V.player?.vaginaExist, false),
        bottomSize: {
          value: safeRead(() => V.player?.bottomsize, 0),
          desc: bottomSizeDesc(safeRead(() => V.player?.bottomsize, 0)),
        },
        bodyShape: safeRead(() => V.player?.bodyshape, 'classic'),
        skinColour: safeRead(() => V.player?.skin?.color, 'light'),
      },
      transformations,
    };
  },
});

// ── get_fame_reputation ─────────────────────────────────────

export const getFameReputation = tool({
  description: [
    'Get the player\'s fame levels (12 categories), crime record,',
    'school reputation (delinquency, coolness), orphanage mood,',
    'and world corruption level.',
    'Use this when the user asks about their reputation, fame, or criminal record.',
  ].join(' '),
  inputSchema: emptyParams,
  execute: async () => {
    logger.info('Executing get_fame_reputation');

    const V = getV();
    if (!V) {
      return { _mock: true, _note: 'Game state not available' };
    }

    // Fame — 12 categories
    const fameKeys = [
      'sex', 'prostitution', 'rape', 'bestiality', 'exhibitionism',
      'pregnancy', 'impreg', 'scrap', 'good', 'business', 'social', 'model',
    ] as const;
    const fame: Record<string, { value: number; level: string }> = {};
    const fameObj = safeRead(() => V.fame, {});
    for (const key of fameKeys) {
      const val = safeRead(() => fameObj[key], 0);
      fame[key] = { value: val, level: fameLevel(val) };
    }

    // Crime record
    const crimeTypes = [
      'assault', 'coercion', 'destruction', 'exposure', 'obstruction',
      'prostitution', 'resisting', 'thievery', 'petty', 'trespassing',
    ] as const;
    const crimeMap: Record<string, { current: number; history: number }> = {};
    let totalCurrent = 0;
    let totalHistory = 0;
    for (const type of crimeTypes) {
      const c = safeRead(() => V.crime?.[type]?.current, 0);
      const h = safeRead(() => V.crime?.[type]?.history, 0);
      crimeMap[type] = { current: c, history: h };
      totalCurrent += c;
      totalHistory += h;
    }

    // Police status tier
    const policeStatus = policeStatusLabel(totalHistory);

    // School
    const delinquency = safeRead(() => V.delinquency, 0);
    const cool = safeRead(() => V.cool, 0);
    const coolMax = safeRead(() => V.coolmax, 400);

    return {
      fame,
      crime: {
        totalCurrent,
        totalHistory,
        types: crimeMap,
      },
      policeStatus,
      school: {
        delinquency: { value: delinquency, level: delinquencyLabel(delinquency) },
        coolness: { value: cool, max: coolMax, level: coolLabel(cool) },
        crossdressingRumor: safeRead(() => V.schoolrep?.crossdress, 0),
        hermRumor: safeRead(() => V.schoolrep?.herm, 0),
      },
      orphanage: (() => {
        const hope = safeRead(() => V.orphan_hope, 0);
        const reb = safeRead(() => V.orphan_reb, 0);
        return { hope, rebellion: reb, mood: orphanageMood(hope, reb) };
      })(),
      worldCorruption: {
        soft: safeRead(() => V.world_corruption_soft, 0),
        hard: safeRead(() => V.world_corruption_hard, 0),
      },
    };
  },
});

// ── End of character tools ──────────────────────────────────
