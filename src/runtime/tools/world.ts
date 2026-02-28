/**
 * World & Scene Tools — 世界状况层 (World & Situation)
 *
 * get_world_state   — 时间/天气/位置
 * get_active_quests — 活跃任务/截止日期
 * get_current_scene — 当前 passage 文本与选择
 *
 * All tools are read-only.
 */
import { tool } from 'ai';
import { toolLogger as logger, emptyParams } from './helpers.js';
import { safeRead, getV, getTime, getWeather } from '../access.js';
import { formatMoney } from '../semantics/index.js';

// ── get_world_state ─────────────────────────────────────────

export const getWorldState = tool({
  description: [
    'Get the current in-game time (hour, minute, day of week, date),',
    'season, weather, moon phase, school schedule, and the player\'s',
    'current location (area, sublocation, inside/outside).',
    'Use this when the user asks about time, weather, location, or "where am I".',
  ].join(' '),
  inputSchema: emptyParams,
  execute: async () => {
    logger.info('Executing get_world_state');

    const V = getV();
    const T = getTime();

    if (!V || !T) {
      return { _mock: true, _note: 'Game state not available' };
    }

    return {
      time: {
        hour: safeRead(() => T.hour, 0),
        minute: safeRead(() => T.minute, 0),
        weekDay: safeRead(() => T.weekDayName, 'unknown'),
        monthDay: safeRead(() => T.monthDay, 1),
        month: safeRead(() => T.monthName, 'unknown'),
        year: safeRead(() => T.year, 1),
        dayState: safeRead(() => T.dayState, 'unknown'),
        season: safeRead(() => T.season, 'unknown'),
        gameDays: safeRead(() => T.days, 0),
      },
      school: {
        term: safeRead(() => T.schoolTerm, false),
        schoolDay: safeRead(() => T.schoolDay, false),
        schoolTime: safeRead(() => T.schoolTime, false),
      },
      moonPhase: safeRead(() => T.currentMoonPhase?.description, 'unknown'),
      weather: safeRead(() => {
        const W = getWeather();
        return W?.name ?? V.weatherObj?.name ?? 'unknown';
      }, 'unknown'),
      location: {
        area: safeRead(() => V.area, 'unknown'),
        location: safeRead(() => V.location, 'unknown'),
        outside: safeRead(() => V.outside, false),
        passage: safeRead(() => (window as any)?.SugarCube?.State?.passage, 'unknown'),
      },
    };
  },
});

// ── get_current_scene ───────────────────────────────────────

export const getCurrentScene = tool({
  description: [
    'Get information about the current game passage (scene), including the',
    'passage name, visible text content (truncated), and available choices/links.',
    'Use this to understand what the player is currently seeing or to help',
    'them decide between available options.',
  ].join(' '),
  inputSchema: emptyParams,
  execute: async () => {
    logger.info('Executing get_current_scene');

    const V = getV();

    try {
      const SugarCube = (window as any)?.SugarCube;
      const passage = SugarCube?.State?.passage;
      const tags: string[] = safeRead(() => SugarCube?.State?.passage
        ? SugarCube.Story?.get(passage)?.tags ?? []
        : [], []);

      const passageEl = document.querySelector('#passages .passage');

      // Extract visible text, truncate to ~2000 chars
      const rawText = passageEl?.textContent ?? '';
      const textContent = rawText.length > 2000
        ? rawText.slice(0, 2000) + '... [truncated]'
        : rawText || '(empty)';

      // Extract clickable choice texts
      const links = passageEl?.querySelectorAll('a, .link-internal') ?? [];
      const availableChoices: string[] = [];
      links.forEach(link => {
        const text = (link as HTMLElement).textContent?.trim();
        if (text && !availableChoices.includes(text)) {
          availableChoices.push(text);
        }
      });

      const majorAreas = safeRead(
        () => (window as any)?.setup?.majorAreas ?? SugarCube?.setup?.majorAreas,
        [],
      );

      return {
        passageName: passage || 'unknown',
        tags,
        textContent,
        availableChoices,
        isInCombat: safeRead(() => V?.combat, 0) === 1,
        isSafePassage: Array.isArray(majorAreas) && majorAreas.includes(passage),
      };
    } catch (e) {
      logger.warn('Failed to read scene context:', e);
      return {
        passageName: 'unknown',
        tags: [] as string[],
        textContent: '(Game passage not accessible)',
        availableChoices: [] as string[],
        isInCombat: false,
        isSafePassage: false,
        _note: 'Error reading passage context',
      };
    }
  },
});

// ── get_active_quests ───────────────────────────────────────

export const getActiveQuests = tool({
  description: [
    'Get currently active quests, time-sensitive reminders, and deadlines.',
    'Includes rent due dates, NPC appointments, community service, school obligations,',
    'and other tracked tasks.',
    'Use this when the user asks "what should I do", "any deadlines", or about rent/tasks.',
  ].join(' '),
  inputSchema: emptyParams,
  execute: async () => {
    logger.info('Executing get_active_quests');

    const V = getV();
    const T = getTime();

    if (!V || !T) {
      return { _mock: true, _note: 'Game state not available' };
    }

    const urgent: Array<{ name: string; description: string; deadline: string | null }> = [];
    const active: Array<{ name: string; description: string; deadline: string | null }> = [];

    // Rent — $renttime is a countdown: starts at 7, decremented daily, ≤0 = overdue
    const rentMoney = safeRead(() => V.rentmoney, 0);
    if (rentMoney > 0) {
      const renttime = safeRead(() => V.renttime, 7);
      const entry = {
        name: 'Bailey\'s Rent',
        description: renttime > 0
          ? `${formatMoney(rentMoney)} due. ${renttime} day(s) left.`
          : `${formatMoney(rentMoney)} OVERDUE by ${Math.abs(renttime)} day(s)!`,
        deadline: renttime <= 0 ? 'overdue' : renttime <= 1 ? 'tomorrow' : `${renttime} days left`,
      };
      if (renttime <= 1) urgent.push(entry);
      else active.push(entry);
    }

    // Community service
    const communityService = safeRead(() => V.community_service, 0);
    if (communityService >= 1) {
      urgent.push({
        name: 'Community Service',
        description: 'Report to the police station on Barb Street.',
        deadline: 'today',
      });
    }

    // Harper appointment (Fridays, weekDay 6)
    const harperEnabled = safeRead(() => V.harper_appointments?.enabled, false);
    const schoolPsych = safeRead(() => V.schoolPsych, 0);
    if ((harperEnabled || schoolPsych === 1) && safeRead(() => T.weekDay, 0) === 6) {
      const visited = safeRead(() => V.daily?.harperVisit, 0);
      if (!visited) {
        urgent.push({
          name: 'Harper Appointment',
          description: 'Appointment with Doctor Harper at the hospital today.',
          deadline: 'today',
        });
      }
    }

    // Eden freedom
    const edenFreedom = safeRead(() => V.edenfreedom, 0);
    if (edenFreedom > 0) {
      const edenDays = safeRead(() => V.edendays, 0);
      active.push({
        name: 'Eden Return',
        description: `Must return to Eden's cabin. ${edenDays} day(s) remain.`,
        deadline: edenDays <= 1 ? 'urgent' : `${edenDays} days`,
      });
    }

    // Brothel show (Fridays, weekDay 6)
    const showType = safeRead(() => V.brothelshowdata?.type, 'none');
    if (showType !== 'none' && safeRead(() => V.brothelshowdata?.intro, false)) {
      if (safeRead(() => T.weekDay, 0) === 6) {
        urgent.push({
          name: 'Brothel Show',
          description: `Perform a ${showType} show at the brothel.`,
          deadline: 'today',
        });
      }
    }

    // Avery date (Saturdays, weekDay 7)
    if (safeRead(() => V.averydate, 0) === 1 && safeRead(() => T.weekDay, 0) === 7) {
      urgent.push({
        name: 'Avery Date',
        description: 'Date with Avery tonight at 20:00.',
        deadline: 'today 20:00',
      });
    }

    // School day
    const schoolDay = safeRead(() => T.schoolDay, false);
    if (schoolDay) {
      const attended = safeRead(() => Object.keys(V.daily?.school?.attended ?? {}), []);
      if (attended.length < 5) {
        const entry = {
          name: 'School',
          description: `${5 - attended.length} lesson(s) remaining today.`,
          deadline: 'before 15:00',
        };
        if (safeRead(() => T.hour, 0) >= 13) urgent.push(entry);
        else active.push(entry);
      }
    }

    // Temple duties — temple_rank is a string: undefined→"prospective"→"initiate"→"monk"→"priest"
    const templeRank = safeRead(() => V.temple_rank, undefined) as string | undefined;
    if (templeRank && templeRank !== 'prospective') {
      active.push({
        name: 'Temple Duties',
        description: `Temple rank: ${templeRank}. Check temple for tasks.`,
        deadline: null,
      });
    }

    // Farm attacks
    const farmStage = safeRead(() => V.farm_stage, 0);
    const farmTimer = safeRead(() => V.farm_attack_timer, 0);
    if (farmStage >= 1 && farmTimer > 0) {
      active.push({
        name: 'Farm Defense',
        description: `Farm attack in ${farmTimer} day(s).`,
        deadline: `${farmTimer} days`,
      });
    }

    // Wren heist — $wrenHeist is a boolean (true = active), companion data in $wrenHeistDance
    const wrenHeist = safeRead(() => V.wrenHeist, false);
    if (wrenHeist === true) {
      active.push({
        name: 'Wren Heist',
        description: 'An active heist job from Wren.',
        deadline: null,
      });
    }

    // Rent summary for quick reference
    let rent: { amount: string; daysLeft: number; nextDue: string } | null = null;
    if (rentMoney > 0) {
      const renttimeFinal = safeRead(() => V.renttime, 7);
      rent = {
        amount: formatMoney(rentMoney),
        daysLeft: Math.max(0, renttimeFinal),
        nextDue: renttimeFinal <= 0 ? 'overdue' : `in ${renttimeFinal} day(s)`,
      };
    }

    return { urgent, active, rent };
  },
});
