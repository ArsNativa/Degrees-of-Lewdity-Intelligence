/**
 * Player statistics variable definitions.
 *
 * Defines all available statistics keys from the game's statistics page.
 * These raw values are collected from SugarCube $variables at snapshot time.
 *
 * No semantic interpretation — just raw counts for LLM consumption.
 */

/** All tracked player statistics categories and their variable keys. */
export const PLAYER_STATS_KEYS = {
  // ── Sexual Acts ──
  sexual: {
    vaginal: 'vaginalstat',
    vaginalEjac: 'vaginalejacstat',
    vaginalEntrance: 'vaginalentranceejacstat',
    vaginalDouble: 'vaginaldoublestat',
    
    anal: 'analstat',
    analEjac: 'analejacstat',
    analDouble: 'analdoublestat',
    
    oral: 'oralstat',
    oralEjac: 'oralejacstat',
    
    hand: 'handstat',
    handEjac: 'handejacstat',
    
    feet: 'feetstat',
    feetEjac: 'feetejacstat',
    
    thigh: 'thighstat',
    thighEjac: 'thighejacstat',
    
    chest: 'cheststat',
    chestEjac: 'chestejacstat',
    
    bottom: 'bottomstat',
    bottomEjac: 'bottomejacstat',
    
    penile: 'penilestat',
    penileEjac: 'penileejacstat',
    
    cunnilingus: 'cunnilingusstat',
    cunnilingusEjac: 'cunnilingusejacstat',
    
    strapon: 'straponstat',
    
    face: 'faceejacstat',
    hair: 'hairejacstat',
    neck: 'neckejacstat',
    tummy: 'tummyejacstat',
    
    totalEjac: 'ejacstat',
  },

  // ── Ingestion ──
  ingestion: {
    semenSwallowed: 'semenswallowedstat',
    animalSemenSwallowed: 'animalsemenswallowedstat',
    milkDrank: 'milk_drank_stat',
    nectarDrank: 'nectar_drank_stat',
  },

  // ── Production ──
  production: {
    semenProduced: 'semen_produced_stat',
    lubeProduced: 'lube_produced_stat',
    milkProduced: 'milk_produced_stat',
    fluidForcedMilked: 'fluid_forced_stat',
  },

  // ── Masturbation ──
  masturbation: {
    total: 'masturbationstat',
    toOrgasm: 'masturbationorgasmstat',
    secondsSpent: 'secondsSpentMasturbating',
  },

  // ── Orgasms (General) ──
  orgasm: {
    total: 'orgasmstat',
    throughStrangulation: 'orgasmDown',
  },

  // ── Services ──
  services: {
    gloryhole: 'gloryholestat',
    prostitution: 'prostitutionstat',
    forcedProstitution: 'forcedprostitutionstat',
    masseur: 'masseur_stat',
    pub: 'pub_task_stat',
    danceFloor: 'dancestat',
    drinksServed: 'drinksservedstat',
    tablesServed: 'tablesservedstat',
  },

  // ── Violence ──
  violence: {
    molested: 'moleststat',
    raped: 'rapestat',
    beastRaped: 'beastrapestat',
    tentacleRaped: 'tentaclerapestat',
    swallowed: 'swallowedstat',
    hit: 'hitstat',
    attack: 'attackstat',
    sprayUsed: 'spraystat',
  },

  // ── Other ──
  other: {
    clothesStripped: 'clothesstripstat',
    clothesRuined: 'clothesruinstat',
    passout: 'passoutstat',
    rescued: 'rescued',
    machine: 'machine_stat',
    knotted: 'knot_stat',
    sexToy: 'sextoystat',
    parasite: 'parasitestat',
    watersports: 'urinestat',
    wildPlant: 'wild_plant_stat',
    smugglerStolen: 'smuggler_stolen_stat',
    creamPie: 'creamstat',
    bunMask: 'bunstat',
    shoot: 'stat_shoot',
    lurkersCapture: 'stat_lurkers_captured',
  },

  // ── Last Event Timestamps ──
  timestamps: {
    lastOrgasm: 'orgasmTimeStat',
    lastRuinedOrgasm: 'ruinedOrgasmTimeStat',
    lastPenile: 'penileTimeStat',
    lastPenileEjac: 'penileEjacTimeStat',
    lastVaginal: 'vaginalTimeStat',
    lastVaginalEjac: 'vaginalEjacTimeStat',
    lastAnal: 'analTimeStat',
    lastAnalEjac: 'analEjacTimeStat',
    lastMasturbation: 'masturbationTimeStat',
    lastMasturbationOrgasm: 'masturbationOrgasmTimeStat',
    lastMolest: 'molestTimeStat',
    lastRape: 'rapeTimeStat',
    lastPassout: 'passoutTimeStat',
  },
} as const;

/**
 * Flatten the nested stats object into a simple key-value map.
 * Used for runtime variable extraction.
 */
export function getPlayerStatsVariables(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const category of Object.values(PLAYER_STATS_KEYS)) {
    Object.assign(result, category);
  }
  return result;
}

/**
 * Get all stat variable names as a flat list (e.g., ['vaginalstat', 'analstat', ...]).
 */
export function getAllStatKeys(): string[] {
  return Object.values(getPlayerStatsVariables());
}

/**
 * Snapshot of raw player statistics (read at combat time).
 * Values are direct copies of $variable values from SugarCube.
 * No filtering — includes undefined/null for unavailable stats.
 */
export interface PlayerStatsSnapshot {
  // ── Sexual Acts ──
  vaginal?: number;
  vaginalEjac?: number;
  vaginalEntrance?: number;
  vaginalDouble?: number;
  
  anal?: number;
  analEjac?: number;
  analDouble?: number;
  
  oral?: number;
  oralEjac?: number;
  
  hand?: number;
  handEjac?: number;
  
  feet?: number;
  feetEjac?: number;
  
  thigh?: number;
  thighEjac?: number;
  
  chest?: number;
  chestEjac?: number;
  
  bottom?: number;
  bottomEjac?: number;
  
  penile?: number;
  penileEjac?: number;
  
  cunnilingus?: number;
  cunnilingusEjac?: number;
  
  strapon?: number;
  
  face?: number;
  hair?: number;
  neck?: number;
  tummy?: number;
  
  totalEjac?: number;

  // ── Ingestion ──
  semenSwallowed?: number;
  animalSemenSwallowed?: number;
  milkDrank?: number;
  nectarDrank?: number;

  // ── Production ──
  semenProduced?: number;
  lubeProduced?: number;
  milkProduced?: number;
  fluidForcedMilked?: number;

  // ── Masturbation ──
  masturbationTotal?: number;
  masturbationToOrgasm?: number;
  masturbationSecond?: number;

  // ── Services ──
  gloryhole?: number;
  prostitution?: number;
  forcedProstitution?: number;
  masseur?: number;
  pub?: number;
  danceFloor?: number;
  drinksServed?: number;
  tablesServed?: number;

  // ── Violence ──
  molested?: number;
  raped?: number;
  beastRaped?: number;
  tentacleRaped?: number;
  swallowed?: number;
  hit?: number;
  attack?: number;
  sprayUsed?: number;

  // ── Other ──
  clothesStripped?: number;
  clothesRuined?: number;
  passout?: number;
  rescued?: number;
  machine?: number;
  knotted?: number;
  sexToy?: number;
  parasite?: number;
  pee?: number;
  wildPlant?: number;
  smugglerStolen?: number;
  creamPie?: number;
  shoot?: number;
  bunMask?: number;
}
