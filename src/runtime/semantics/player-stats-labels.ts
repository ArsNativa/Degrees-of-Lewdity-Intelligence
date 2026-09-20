/**
 * Player statistics labels and formatting.
 *
 * Maps raw variable keys to human-readable labels, units, and categories.
 * Used to transform raw statistics into semantically meaningful output for LLM.
 */

/** Metadata for a single statistic: label, unit, category. */
export interface StatMetadata {
  /** Human-readable label (e.g., "Vaginal penetrations", "Semen swallowed"). */
  label: string;
  /** Unit of measurement (e.g., "times", "mL", "days"). Empty string for unitless. */
  unit: string;
  /** Category for grouping (e.g., "sexual", "ingestion", "violence"). */
  category: 'sexual' | 'ingestion' | 'production' | 'violence' | 'services' | 'orgasm' | 'timestamps' | 'other';
}

/** Complete mapping of statistic variable name → metadata. */
export const STAT_METADATA: Record<string, StatMetadata> = {
  // ── Sexual Acts ──
  vaginalstat: { label: 'Vaginal penetrations', unit: 'times', category: 'sexual' },
  vaginalejacstat: { label: 'Ejaculated in vagina', unit: 'times', category: 'sexual' },
  vaginalentranceejacstat: { label: 'Ejaculated on pussy', unit: 'times', category: 'sexual' },
  vaginaldoublestat: { label: 'Double vaginally penetrated', unit: 'times', category: 'sexual' },
  
  analstat: { label: 'Anal penetrations', unit: 'times', category: 'sexual' },
  analejacstat: { label: 'Ejaculated in anus', unit: 'times', category: 'sexual' },
  analdoublestat: { label: 'Double anally penetrated', unit: 'times', category: 'sexual' },
  
  oralstat: { label: 'Oral sex given', unit: 'times', category: 'sexual' },
  oralejacstat: { label: 'Ejaculated in mouth', unit: 'times', category: 'sexual' },
  
  handstat: { label: 'Handjobs given', unit: 'times', category: 'sexual' },
  handejacstat: { label: 'Handjob ejaculations', unit: 'times', category: 'sexual' },
  
  feetstat: { label: 'Footjobs given', unit: 'times', category: 'sexual' },
  feetejacstat: { label: 'Footjob ejaculations', unit: 'times', category: 'sexual' },
  
  thighstat: { label: 'Thighjobs given', unit: 'times', category: 'sexual' },
  thighejacstat: { label: 'Thighjob ejaculations', unit: 'times', category: 'sexual' },
  
  cheststat: { label: 'Chestjobs given', unit: 'times', category: 'sexual' },
  chestejacstat: { label: 'Chestjob ejaculations', unit: 'times', category: 'sexual' },
  
  bottomstat: { label: 'Buttjobs given', unit: 'times', category: 'sexual' },
  bottomejacstat: { label: 'Buttjob ejaculations', unit: 'times', category: 'sexual' },
  
  penilestat: { label: 'Penile exposures', unit: 'times', category: 'sexual' },
  penileejacstat: { label: 'Penis ejaculations', unit: 'times', category: 'sexual' },
  
  cunnilingusstat: { label: 'Cunnilingus given', unit: 'times', category: 'sexual' },
  cunnilingusejacstat: { label: 'Cunnilingus ejaculations', unit: 'times', category: 'sexual' },
  
  straponstat: { label: 'Strapon uses', unit: 'times', category: 'sexual' },
  
  faceejacstat: { label: 'Ejaculated on face', unit: 'times', category: 'sexual' },
  hairejacstat: { label: 'Ejaculated on hair', unit: 'times', category: 'sexual' },
  neckejacstat: { label: 'Ejaculated on neck', unit: 'times', category: 'sexual' },
  tummyejacstat: { label: 'Ejaculated on tummy', unit: 'times', category: 'sexual' },
  
  ejacstat: { label: 'Total times ejaculated on/in', unit: 'times', category: 'sexual' },
  
  // ── Orgasms ──
  orgasmstat: { label: 'Total orgasms', unit: 'times', category: 'orgasm' },
  orgasmDown: { label: 'Orgasms through strangulation', unit: 'times', category: 'orgasm' },
  
  // ── Ingestion ──
  semenswallowedstat: { label: 'Semen swallowed', unit: 'mL', category: 'ingestion' },
  animalsemenswallowedstat: { label: 'Animal semen swallowed', unit: 'mL', category: 'ingestion' },
  milk_drank_stat: { label: 'Breast milk consumed', unit: 'mL', category: 'ingestion' },
  nectar_drank_stat: { label: 'Nectar consumed', unit: 'mL', category: 'ingestion' },
  
  // ── Production ──
  semen_produced_stat: { label: 'Semen produced', unit: 'mL', category: 'production' },
  lube_produced_stat: { label: 'Lewd fluid produced', unit: 'mL', category: 'production' },
  milk_produced_stat: { label: 'Breast milk produced', unit: 'mL', category: 'production' },
  fluid_forced_stat: { label: 'Fluid forcibly milked', unit: 'mL', category: 'production' },
  
  // ── Masturbation ──
  masturbationstat: { label: 'Masturbations', unit: 'times', category: 'sexual' },
  masturbationorgasmstat: { label: 'Masturbation orgasms', unit: 'times', category: 'sexual' },
  secondsSpentMasturbating: { label: 'Masturbation time', unit: 'minutes', category: 'sexual' },
  
  // ── Services ──
  gloryholestat: { label: 'Gloryholes serviced', unit: 'times', category: 'services' },
  prostitutionstat: { label: 'Prostitution acts', unit: 'times', category: 'services' },
  forcedprostitutionstat: { label: 'Forced prostitution acts', unit: 'times', category: 'services' },
  masseur_stat: { label: 'Masseur services', unit: 'times', category: 'services' },
  pub_task_stat: { label: 'Pub tasks completed', unit: 'times', category: 'services' },
  dancestat: { label: 'Dance performances', unit: 'times', category: 'services' },
  drinksservedstat: { label: 'Drinks served', unit: 'times', category: 'services' },
  tablesservedstat: { label: 'Tables served', unit: 'times', category: 'services' },
  
  // ── Violence ──
  moleststat: { label: 'Times molested', unit: 'times', category: 'violence' },
  rapestat: { label: 'Times raped', unit: 'times', category: 'violence' },
  beastrapestat: { label: 'Times raped by beasts', unit: 'times', category: 'violence' },
  tentaclerapestat: { label: 'Times raped by tentacles', unit: 'times', category: 'violence' },
  swallowedstat: { label: 'Times swallowed (vore)', unit: 'times', category: 'violence' },
  hitstat: { label: 'Times hit', unit: 'times', category: 'violence' },
  attackstat: { label: 'Times attacked others', unit: 'times', category: 'violence' },
  spraystat: { label: 'Pepper spray used', unit: 'times', category: 'violence' },
  
  // ── Other ──
  clothesstripstat: { label: 'Clothing stripped', unit: 'times', category: 'other' },
  clothesruinstat: { label: 'Clothing ruined', unit: 'times', category: 'other' },
  passoutstat: { label: 'Times passed out', unit: 'times', category: 'other' },
  rescued: { label: 'Times rescued', unit: 'times', category: 'other' },
  machine_stat: { label: 'Machines disabled', unit: 'times', category: 'other' },
  knot_stat: { label: 'Times knotted', unit: 'times', category: 'other' },
  sextoystat: { label: 'Sex toys used on others', unit: 'times', category: 'other' },
  urinestat: { label: 'Times urinated on', unit: 'times', category: 'other' },
  wild_plant_stat: { label: 'Plant interactions', unit: 'times', category: 'other' },
  creamstat: { label: 'Cream pies received', unit: 'times', category: 'other' },
  bunstat: { label: 'Bun mask wears', unit: 'times', category: 'other' },
  stat_shoot: { label: 'Practice shots fired', unit: 'times', category: 'other' },
  stat_lurkers_captured: { label: 'Lurkers captured', unit: 'times', category: 'other' },
  smuggler_stolen_stat: { label: 'Stolen from smuggler', unit: 'times', category: 'other' },
  parasitestat: { label: 'Parasites hosted', unit: 'times', category: 'other' },
  
  // ── Last Event Timestamps (do not display in normal serialization) ──
  orgasmTimeStat: { label: 'Last orgasm', unit: '', category: 'timestamps' },
  ruinedOrgasmTimeStat: { label: 'Last ruined orgasm', unit: '', category: 'timestamps' },
  penileTimeStat: { label: 'Last penetrated others', unit: '', category: 'timestamps' },
  penileEjacTimeStat: { label: 'Last ejaculated in others', unit: '', category: 'timestamps' },
  vaginalTimeStat: { label: 'Last vaginally penetrated', unit: '', category: 'timestamps' },
  vaginalEjacTimeStat: { label: 'Last ejaculated in vaginally', unit: '', category: 'timestamps' },
  analTimeStat: { label: 'Last anally penetrated', unit: '', category: 'timestamps' },
  analEjacTimeStat: { label: 'Last ejaculated in anally', unit: '', category: 'timestamps' },
  masturbationTimeStat: { label: 'Last masturbated', unit: '', category: 'timestamps' },
  masturbationOrgasmTimeStat: { label: 'Last masturbated to orgasm', unit: '', category: 'timestamps' },
  molestTimeStat: { label: 'Last molested', unit: '', category: 'timestamps' },
  rapeTimeStat: { label: 'Last raped', unit: '', category: 'timestamps' },
  passoutTimeStat: { label: 'Last passed out', unit: '', category: 'timestamps' },
};

/**
 * Use class DateTime to calculate relative time (Stimulate <<statisticsTimeCompare>>)
 * @param timestampVar (ex: $vaginalTimeStat)
 * @returns string of relative times, ex: "2 hours, 53 minutes ago" or "recently" or "never"
 */
function formatGameRelativeTime(timestampVar: number | undefined): string {
  if (timestampVar === undefined || timestampVar === 0) {
    return 'never';
  }

  const GlobalDateTime = (window as any).DateTime;
  const gameTime = (window as any).Time?.date;
  if (typeof GlobalDateTime !== 'function' || !gameTime) {

    return '';
  }

  try {
    const eventDate = new GlobalDateTime(timestampVar);
    const diff = eventDate.compareWith(gameTime);

    const parts: string[] = [];
    if (diff.years) parts.push(`${diff.years} year${diff.years > 1 ? 's' : ''}`);
    if (diff.months) parts.push(`${diff.months} month${diff.months > 1 ? 's' : ''}`);
    if (diff.days) parts.push(`${diff.days} day${diff.days > 1 ? 's' : ''}`);
    if (diff.hours) parts.push(`${diff.hours} hour${diff.hours > 1 ? 's' : ''}`);
    if (diff.minutes) parts.push(`${diff.minutes} minute${diff.minutes > 1 ? 's' : ''}`);

    if (parts.length === 0) {
      return 'recently';
    }
    return parts.join(', ') + ' ago';
  } catch (e) {
    console.warn('Failed to parse timestamp:', timestampVar, e);
    return '';
  }
}

/**
 * Map count stats to their corresponding timestamp stats.
 */
const STAT_TO_TIMESTAMP: Record<string, string> = {
  orgasmstat: 'orgasmTimeStat',
  ruinedOrgasmStat: 'ruinedOrgasmTimeStat',
  penilestat: 'penileTimeStat',
  penileejacstat: 'penileEjacTimeStat',
  vaginalstat: 'vaginalTimeStat',
  vaginalejacstat: 'vaginalEjacTimeStat',
  analstat: 'analTimeStat',
  analejacstat: 'analEjacTimeStat',
  masturbationstat: 'masturbationTimeStat',
  masturbationorgasmstat: 'masturbationOrgasmTimeStat',
  moleststat: 'molestTimeStat',
  rapestat: 'rapeTimeStat',
  passoutstat: 'passoutTimeStat',
};

/**
 * Format a single statistic for human readability.
 * @param variableName The SugarCube variable name (e.g., 'vaginalstat')
 * @param value The raw numeric value
 * @returns Formatted string (e.g., "Vaginal penetrations: 1768 times")
 */
export function formatStat(variableName: string, value: number | undefined): string | null {
  if (value === undefined || value === 0) return null;

  const meta = STAT_METADATA[variableName];
  if (!meta) return null; // Unknown stat — skip

  // Special handling for time values (convert seconds to minutes)
  let displayValue: string;
  if (variableName === 'secondsSpentMasturbating') {
    const minutes = Math.trunc(value / 60);
    displayValue = String(minutes);
  } else {
    displayValue = String(Math.floor(value));
  }

  if (meta.unit) {
    return `${meta.label}: ${displayValue} ${meta.unit}`;
  } else {
    return `${meta.label}: ${displayValue}`;
  }
}

/**
 * Get all statistics organized by category.
 * Includes timestamps formatted as relative time (e.g., "5 days ago").
 * @param stats Statistics data
 * @param currentGameTime Current game time timestamp (in seconds) - used to calculate elapsed time from recorded timestamps
 */
export function groupStatsByCategory(stats: Record<string, number | undefined>, currentGameTime: number = 0): 
  Record<string, Array<{ label: string; value: string }>> {
  
  const grouped: Record<string, Array<{ label: string; value: string }>> = {};
  
  for (const [varName, value] of Object.entries(stats)) {
    if (value === undefined || value === 0) continue;
    
    const meta = STAT_METADATA[varName];
    if (!meta) continue;
    
    // Skip raw timestamp entries - they are handled via STAT_TO_TIMESTAMP mapping
    if (meta.category === 'timestamps') continue;
    
    if (!grouped[meta.category]) {
      grouped[meta.category] = [];
    }
    
    // Format the count value
    let displayValue: string;
    if (varName === 'secondsSpentMasturbating') {
      const minutes = Math.trunc(value / 60);
      displayValue = `${minutes}`;
    } else {
      displayValue = String(Math.floor(value));
    }
    
    const unitStr = meta.unit ? ` ${meta.unit}` : '';
    grouped[meta.category].push({
      label: meta.label,
      value: `${displayValue}${unitStr}`,
    });
    
    // Also add the corresponding timestamp if it exists
    const timestampVarName = STAT_TO_TIMESTAMP[varName];
    if (timestampVarName) {
      const recordedTimestamp = stats[timestampVarName];
      if (recordedTimestamp !== undefined) {
        const relativeTime = formatGameRelativeTime(recordedTimestamp);
        if (relativeTime && relativeTime !== 'never') {
          if (!grouped[meta.category]) grouped[meta.category] = [];
          const metaLabel = STAT_METADATA[varName]?.label || '';
          const lastLabel = `Last ${metaLabel.charAt(0).toLowerCase()}${metaLabel.slice(1)}`;
          grouped[meta.category].push({
            label: lastLabel,
            value: relativeTime,
          });
        }
      }
    }
  }
  
  return grouped;
}
