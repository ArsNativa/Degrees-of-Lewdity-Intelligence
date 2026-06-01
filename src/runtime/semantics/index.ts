/**
 * Semantics barrel — re-exports all semantic mapping functions.
 *
 * Usage:
 *   import { arousalLevel, skillGrade, fameLevel } from '../semantics/index.js';
 */

// Shared numeric helpers (re-exported from utils for convenience)
export { fmtNum, formatMoney } from '../../utils/format.js';

// Status bars (trauma, stress, arousal, control, pain, fatigue, hunger)
export {
  traumaLevel,
  stressLevel,
  arousalLevel,
  controlLevel,
  statusLevel,
  fatigueLevel,
  hungerLevel,
  painLevel,
} from './status-bars.js';

// Skills (basic/detailed skill grades, school subject grades)
export {
  skillGrade,
  detailedSkillGrade,
  subjectGrade,
} from './skills.js';

// Social (fame, police, delinquency, coolness, orphanage mood)
export {
  fameLevel,
  policeStatusLabel,
  delinquencyLabel,
  coolLabel,
  orphanageMood,
} from './social.js';

// Body (breast/penis/bottom sizes, gender label)
export {
  breastSizeDesc,
  penisSizeDesc,
  bottomSizeDesc,
  genderLabel,
} from './body.js';

// Body liquids (liquid types, body parts, amount levels, descriptions)
export {
  LIQUID_TYPES,
  LIQUID_NAMES,
  BODY_LIQUID_PARTS,
  BODY_PART_NAMES,
  liquidAmountLevel,
  liquidVaginaDesc,
  liquidBottomDesc,
  liquidOralDesc,
  liquidPartialDesc,
} from './body-liquids.js';

// Clothing (integrity, exposure)
export {
  integrityLabel,
  exposureLabel,
} from './clothing.js';

// Relationships (NPC relationship, player submissiveness)
export {
  relationLevel,
  submissiveLevel,
} from './relationship.js';

// Enemy / NPC combat stats (health, arousal, anger, trust, penis size)
export {
  enemyHealthLevel,
  enemyArousalLevel,
  enemyAngerLevel,
  enemyTrustLevel,
  npcPenisSizeDesc,
} from './enemy.js';

// Combat action codes → readable labels
export {
  actionLabel,
  combatVarLabel,
  BODY_ACTION_KEYS,
  SUB_ACTION_KEYS,
  ALL_ACTION_KEYS,
  TARGET_KEYS,
} from './actions.js';

// Player statistics (raw variable definitions and snapshots)
export {
  PLAYER_STATS_KEYS,
  getAllStatKeys,
  getPlayerStatsVariables,
  type PlayerStatsSnapshot,
} from './player-stats.js';

// Player statistics labels and formatting
export {
  STAT_METADATA,
  formatStat,
  groupStatsByCategory,
  type StatMetadata,
} from './player-stats-labels.js';
