/**
 * Combat action code → human-readable label translation (semantics layer).
 *
 * DoL stores player combat choices as internal code strings
 * (e.g. "leftchest", "vaginatopenis", "kissskin").
 * These codes are NOT exposed at runtime in any dictionary —
 * they live as local variables inside Twee widget definitions.
 *
 * Strategy: small override dictionary for opaque codes,
 * plus rule-based decomposition for the majority that follow
 * predictable patterns (prefix stripping + camelCase splitting).
 *
 * Source of truth: DOL/game/base-combat/actions-*.twee,
 *                  DOL/game/base-combat/actionsGeneration.twee
 */

// ── Override dictionary for opaque / ambiguous codes ──────

/**
 * Codes whose meaning cannot be derived by pattern rules.
 * Values are short English descriptions suitable for LLM consumption.
 * ~50 entries covering the most common/unclear codes.
 */
const ACTION_LABELS: Record<string, string> = {
  // ── Hand actions ──
  leftchest: 'stroke chest',
  rightchest: 'stroke chest',
  lefthit: 'punch',
  righthit: 'punch',
  leftgrab: 'grab penis',
  rightgrab: 'grab penis',
  leftstroke: 'stroke penis',
  rightstroke: 'stroke penis',
  leftplay: 'play with pussy',
  rightplay: 'play with pussy',
  leftclit: 'rub clit',
  rightclit: 'rub clit',
  leftwork: 'work shaft',
  rightwork: 'work shaft',
  leftcoverface: 'cover face',
  rightcoverface: 'cover face',
  leftcoveranus: 'cover anus',
  rightcoveranus: 'cover anus',
  leftcoveranuslewd: 'play with anus (cover)',
  rightcoveranuslewd: 'play with anus (cover)',
  leftcoveranusmeek: 'cover anus (meek)',
  rightcoveranusmeek: 'cover anus (meek)',
  leftcovervagina: 'cover pussy',
  rightcovervagina: 'cover pussy',
  leftcovervaginalewd: 'play with pussy (cover)',
  rightcovervaginalewd: 'play with pussy (cover)',
  leftcovervaginameek: 'cover pussy (meek)',
  rightcovervaginameek: 'cover pussy (meek)',
  leftcoverpenis: 'cover penis',
  rightcoverpenis: 'cover penis',
  leftcoverpenislewd: 'play with penis (cover)',
  rightcoverpenislewd: 'play with penis (cover)',
  leftcoverpenismeek: 'cover penis (meek)',
  rightcoverpenismeek: 'cover penis (meek)',
  leftcamerapose: 'pose for camera',
  rightcamerapose: 'pose for camera',
  leftmasturbateanus: 'masturbate anus',
  rightmasturbateanus: 'masturbate anus',
  leftmasturbatepenis: 'masturbate penis',
  rightmasturbatepenis: 'masturbate penis',
  leftmasturbatepussy: 'masturbate pussy',
  rightmasturbatepussy: 'masturbate pussy',
  leftskirtpull: 'pull skirt down',
  rightskirtpull: 'pull skirt down',
  leftlowerpull: 'fix lower clothing',
  rightlowerpull: 'fix lower clothing',
  leftoverlowerpull: 'fix over-lower clothing',
  rightoverlowerpull: 'fix over-lower clothing',
  leftupperpull: 'fix upper clothing',
  rightupperpull: 'fix upper clothing',
  leftoverupperpull: 'fix over-upper clothing',
  rightoverupperpull: 'fix over-upper clothing',
  leftunderpull: 'pull up underwear',
  rightunderpull: 'pull up underwear',
  leftescape: 'escape (hand)',
  rightescape: 'escape (hand)',
  lefthold: 'hold on',
  righthold: 'hold on',
  leftswarm: 'fend off swarm',
  rightswarm: 'fend off swarm',
  leftbanish: 'banish',
  rightbanish: 'banish',
  lefthandholdnew: 'hold hand',
  righthandholdnew: 'hold hand',
  lefthandholdkeep: 'keep holding hand',
  righthandholdkeep: 'keep holding hand',
  lefthandholdstop: 'let go of hand',
  righthandholdstop: 'let go of hand',
  leftstop: 'stop',
  rightstop: 'stop',
  leftfree: 'free hand',
  rightfree: 'free hand',
  leftprotect: 'protect',
  rightprotect: 'protect',
  leftstruggle: 'struggle',
  rightstruggle: 'struggle',
  leftstruggleweak: 'struggle (weak)',
  rightstruggleweak: 'struggle (weak)',
  leftrub: 'rub',
  rightrub: 'rub',
  leftpoke: 'poke',
  rightpoke: 'poke',
  behind: 'hold behind back',
  spray: 'pepper spray',
  steal: 'steal',
  penwhack: 'whack writing tool away',
  shacklewhack: 'whack shackles away',
  hypnosiswhack: 'whack hypnotic instrument',
  dildowhack: 'whack dildo away',
  keepchoke: 'press hand to neck',
  stopchoke: 'remove hand from neck',
  stopchokenoncon: 'pull hand off neck',
  handpullpenis: 'pull hand off penis',
  handpullvagina: 'pull hand off pussy',
  handpullanus: 'pull hand off anus',
  handguide: 'guide hand',
  frontcoverleft: 'cover front',
  frontcoverright: 'cover front',
  backcoverleft: 'cover back',
  backcoverright: 'cover back',
  frontpurgeleft: 'remove swarm (front)',
  frontpurgeright: 'remove swarm (front)',
  backpurgeleft: 'remove swarm (back)',
  backpurgeright: 'remove swarm (back)',
  frontclearleft: 'clear swarm (front)',
  frontclearright: 'clear swarm (front)',
  backclearleft: 'clear swarm (back)',
  backclearright: 'clear swarm (back)',
  chestclearleft: 'clear swarm (chest)',
  chestclearright: 'clear swarm (chest)',

  // ── Clothing displacement (hand) ──
  over_upper: 'displace over-upper',
  upper: 'displace upper',
  under_upper: 'displace under-upper',
  over_lower: 'displace over-lower',
  lower: 'displace lower',
  under_lower: 'displace under-lower',
  under_lower_to_the_side: 'pull underwear aside',
  mask: 'displace mask',
  removebuttplug: 'remove butt plug',

  // ── Mouth actions ──
  kissskin: 'kiss skin',
  kisslips: 'kiss lips',
  kissback: 'kiss back',
  pullawaykiss: 'pull away from kiss',
  headbutt: 'headbutt',
  handbite: 'bite hand',
  handbiteW: 'bite hand',
  handcloseW: 'clamp mouth shut',
  mouthacceptW: 'accept (mouth)',
  mouthresistW: 'resist (mouth)',
  stifle: 'stifle moans',
  stifleorgasm: 'stifle orgasm',
  letout: 'let out moans',
  letoutorgasm: 'let out orgasm',
  speak: 'try to speak',
  noises: 'make soft noises',
  scream: 'scream',
  ask: 'ask',
  mock: 'mock',
  disparage: 'disparage',
  apologise: 'apologise',
  plead: 'plead',
  demand: 'demand',
  taunt: 'taunt',
  moan: 'moan',
  growl: 'growl',
  mouth: 'move mouth to penis',
  othervagina: 'move mouth to pussy',
  movetochest: 'move mouth to chest',
  swallow: 'take into mouth',
  bite: 'bite',
  lick: 'lick',
  suck: 'suck',
  ejacspit: 'spit out',
  ejacswallow: 'swallow',
  mouthbite: 'bite',
  mouthkiss: 'kiss',
  mouthlick: 'lick',
  mouthlull: 'lull',
  mouthcooperate: 'cooperate (mouth)',
  mouthpullaway: 'pull away (mouth)',

  // ── Feet actions ──
  kick: 'kick',
  grab: 'grab with feet',
  grabrub: 'rub with feet',
  feetrub: 'rub with feet',
  feetgrab: 'grab with feet',
  feethit: 'kick',
  feetshoes: 'kick off shoes',
  feetsocks: 'kick off socks',
  feetswarm: 'fend off swarm (feet)',
  legLock: 'leg lock',
  legLocked: 'leg locked',
  legRelease: 'release legs',
  hobble: 'hobble',

  // ── Vagina actions ──
  vaginatopenis: 'straddle penis',
  vaginatopenisdouble: 'straddle penis (double)',
  vaginatovagina: 'press pussy against pussy',
  vaginatovaginafuck: 'grind pussy against pussy',
  vaginapenisfuck: 'envelop penis (vagina)',
  vaginapenisdoublefuck: 'envelop penis double (vagina)',
  vaginapullaway: 'pull away (vagina)',
  vaginarub: 'rub (vagina)',
  vaginagrab: 'grab (vagina)',
  vaginagrabrub: 'rub against (vagina)',
  vaginalick: 'lick (vagina)',
  vaginacooperate: 'cooperate (vagina)',
  vaginaEdging: 'edge (vagina)',
  thighbay: 'block with thigh',
  othermouthtease: 'rub against face',
  othermouthrub: 'rub against lips',
  othermouthescape: 'pull away from mouth',
  othermouthcooperate: 'cooperate with mouth',
  othermouthstop: 'stop mouth contact',
  pullawayvagina: 'pull away (vagina)',

  // ── Anus actions ──
  anustopenis: 'straddle penis (anus)',
  anustopenisdouble: 'straddle penis double (anus)',
  anuspenisfuck: 'envelop penis (anus)',
  anuspenisdoublefuck: 'envelop penis double (anus)',
  anuspullaway: 'pull away (anus)',
  anusrub: 'rub (anus)',
  anuscooperate: 'cooperate (anus)',
  bottombay: 'press butt against mouth',
  bottomhandbay: 'clench against hand',
  penischeeks: 'block with cheeks',
  penispussy: 'offer pussy instead',
  penispussydouble: 'offer pussy instead (double)',
  penispussydap: 'offer pussy instead (DAP)',

  // ── Penis actions ──
  penistovagina: 'press against pussy',
  penistoanus: 'press against anus',
  penistopenis: 'frot',
  penistopenisfuck: 'frot (active)',
  penisvaginafuck: 'penetrate pussy',
  penisanusfuck: 'penetrate anus',
  penisanus: 'press against anus',
  penisanusdouble: 'press against anus (double)',
  penisanusdvp: 'DVP (anus)',
  peniskiss: 'kiss (penis)',
  penisrub: 'rub (penis)',
  penistease: 'tease tip',
  penisdoubletease: 'tease (double)',
  penisEdging: 'edge',
  penisDoubleEdging: 'edge (double)',
  peniscooperate: 'cooperate (penis)',
  penispullaway: 'pull away (penis)',
  penisthighs: 'thrust between thighs',
  peniscondom: 'put on condom',
  penisremovecondom: 'remove condom',
  npcgivecondom: 'give condom to NPC',
  npcremovecondom: 'remove NPC condom',

  // ── Chest/thigh actions ──
  chestrub: 'rub chest',
  breastsuck: 'suck breast',
  breastlick: 'lick breast',
  breastbite: 'bite breast',
  breastpull: 'pull breast',
  breastclosed: 'close chest',
  clitrub: 'rub clit',

  // ── General actions ──
  rest: 'rest',
  cooperate: 'cooperate',
  take: 'take it',
  doubletake: 'take it (double)',
  escape: 'pull away',
  doubleescape: 'pull away (double)',
  rub: 'rub',
  tease: 'tease',
  clench: 'clench',
  stop: 'stop',
  run: 'run',
  swim: 'swim',
  walk: 'walk',
  stand: 'stand up',
  turn: 'turn around',
  hide: 'hide',
  evade: 'evade',
  guard: 'guard',
  strut: 'strut',
  confront: 'confront',
  forgive: 'forgive',
  capture: 'capture',
  pay: 'pay',
  open: 'open',
  down: 'go down',
  up: 'go up',
  handtease: 'tease with hand',
  handcooperate: 'cooperate with hand',
  handtake: 'take hand action',
  handedge: 'edge with hand',
  oraledge: 'edge orally',
  plant: 'plant feet',
  wiggle: 'wiggle',
  fold: 'fold',
  showbottom: 'show bottom',
  showmouth: 'show mouth',
  showpenis: 'show penis',
  showthighs: 'show thighs',
  showvagina: 'show vagina',

  // ── Sex toy actions ──
  dildoDrop: 'drop sex toy',
  dildoDropLeft: 'drop sex toy (left)',
  dildoDropRight: 'drop sex toy (right)',
  dildoDropAnus: 'drop sex toy (anus)',
  dildoDropAnusLeft: 'drop sex toy (anus, left)',
  dildoDropAnusRight: 'drop sex toy (anus, right)',
  strokerDrop: 'drop stroker',
  strokerDropLeft: 'drop stroker (left)',
  strokerDropRight: 'drop stroker (right)',
  dildoSelfPussy: 'use toy on pussy',
  dildoSelfPussyEntrance: 'tease pussy with toy',
  dildoSelfAnus: 'use toy on anus',
  dildoSelfAnusEntrance: 'tease anus with toy',
  dildoOtherPussyTease: 'tease NPC pussy with toy',
  dildoOtherPussyFuck: 'use toy on NPC pussy',
  dildoOtherAnusTease: 'tease NPC anus with toy',
  dildoOtherAnusFuck: 'use toy on NPC anus',
  strokerSelfPenis: 'use stroker on self',
  strokerSelfPenisEntrance: 'tease self with stroker',
  strokerOtherPenisTease: 'tease NPC penis with stroker',
  strokerOtherPenisFuck: 'use stroker on NPC penis',
  strokerCooperate: 'cooperate with stroker',
  strokerRest: 'rest (stroker)',
  pickupSexToy: 'pick up sex toy',
  heldSexToy: 'holding sex toy',

  // ── Special body interaction ──
  analkiss: 'anal kiss',
  anallick: 'anal lick',
  analpull: 'anal pull',
  anal_push: 'anal push',
  anal_whack: 'anal whack',
  vaginal_push: 'vaginal push',
  vaginal_whack: 'vaginal whack',
  otheranusbay: 'block anus contact',
  otheranuscooperate: 'cooperate (other anus)',
  otheranusEdging: 'edge (other anus)',
  otheranusescape: 'escape (other anus)',
  otheranusrub: 'rub (other anus)',
  otherAnusRub: 'rub (other anus)',
  otheranusstop: 'stop (other anus)',
  otherAnusStop: 'stop (other anus)',
  otheranustake: 'take (other anus)',
  otheranustease: 'tease (other anus)',
  otherMouthAnusRub: 'rub anus with mouth',
  otherMouthAnusStop: 'stop mouth on anus',
  otherpenisrub: 'rub other penis',
  othervaginarub: 'rub other vagina',

  // ──  Struggle / restraint ──
  chain_struggle: 'struggle against chains',
  ambush: 'ambush',
  bay: 'block',
  pursuit_grab: 'grab (pursuit)',
  forceImpregnation: 'force impregnation',
  pullOut: 'pull out',
  askchoke: 'ask about choking',

  // ── Tribbing ──
  tribcooperate: 'cooperate (tribbing)',
  tribedge: 'edge (tribbing)',
  tribescape: 'pull away (tribbing)',
  tribrest: 'rest (tribbing)',
  tribtake: 'take (tribbing)',

  // ── Fencing ──
  fencingcooperate: 'cooperate (fencing)',
  fencingescape: 'escape (fencing)',
  fencingtake: 'take (fencing)',
};

// ── Fallback: rule-based decomposition ────────────────────

/**
 * Attempt to produce a readable label from an action code
 * by stripping known prefixes and inserting spaces at
 * camelCase boundaries.
 */
function decompose(code: string): string {
  let s = code;

  // Strip left/right prefix (already conveyed by the key name)
  s = s.replace(/^(?:left|right)/, '');

  // Insert space before uppercase letters (camelCase → spaced)
  s = s.replace(/([a-z])([A-Z])/g, '$1 $2');

  // Replace "to" junction: "vaginatopenis" → "vagina to penis"
  s = s.replace(/^(\w+?)to(\w+)$/i, '$1 → $2');

  // Lowercase the whole thing
  s = s.toLowerCase();

  // Trim leading/trailing whitespace
  return s.trim() || code;
}

// ── Intent field categorization ────────────────────────────

/** The 9 main body-part action keys in IntentSnapshot. */
export const BODY_ACTION_KEYS = [
  'leftaction', 'rightaction', 'mouthaction', 'feetaction',
  'penisaction', 'vaginaaction', 'anusaction', 'chestaction', 'thighaction',
] as const;

/** Sub-action selector keys (dependent on a body action). */
export const SUB_ACTION_KEYS = ['askAction', 'mockaction'] as const;

/** All action keys (body + sub-action). */
export const ALL_ACTION_KEYS = [...BODY_ACTION_KEYS, ...SUB_ACTION_KEYS] as const;

/** Player target-slot keys. */
export const TARGET_KEYS = ['mouthtarget', 'lefttarget', 'righttarget', 'feettarget'] as const;

export type CombatActionKey = typeof ALL_ACTION_KEYS[number];
export type CombatTargetKey = typeof TARGET_KEYS[number];

// ── Public API ────────────────────────────────────────────

/**
 * Human-readable labels for internal combat variable names
 * (action keys, target keys, NPC body-part targeting keys).
 */
const COMBAT_VAR_LABELS: Record<string, string> = {
  // Player action keys
  leftaction:   'left hand',
  rightaction:  'right hand',
  mouthaction:  'mouth',
  feetaction:   'feet',
  penisaction:  'penis',
  vaginaaction: 'vagina',
  anusaction:   'anus',
  chestaction:  'chest',
  thighaction:  'thighs',
  // Special actions with selection
  askAction:    'ask',
  mockaction:   'mock',
  // Player target keys
  mouthtarget:  'mouth target',
  lefttarget:   'left hand target',
  righttarget:  'right hand target',
  feettarget:   'feet target',
  // NPC body-part targeting keys
  lefthand:     'left hand',
  righthand:    'right hand',
  mouth:        'mouth',
  penis:        'penis',
  vagina:       'vagina',
  chest:        'chest',
};

/**
 * Translate a combat variable name to its human-readable label.
 *
 * @param key  Variable name (e.g. "leftaction", "mouthtarget", "righthand").
 * @returns    Label (e.g. "left hand", "mouth target").
 *             Falls back to the raw key if no label exists.
 */
export function combatVarLabel(key: string): string {
  return COMBAT_VAR_LABELS[key] ?? key;
}

/**
 * Translate a DoL combat action code into a human-readable label.
 *
 * @param code  Raw action code string (e.g. "leftchest", "vaginatopenis").
 * @returns     Readable label (e.g. "stroke chest", "straddle penis").
 *              Returns the original code if no translation is available
 *              and rule decomposition yields nothing useful.
 */
export function actionLabel(code: string | number): string {
  if (typeof code === 'number') return code === 0 ? 'rest' : String(code);
  if (!code || code === 'rest' || code === '0') return 'rest';

  // 1. Dictionary lookup
  const label = ACTION_LABELS[code];
  if (label) return label;

  // 2. Dynamic prefix: "$_part + '_pull'" generates codes like "tentacle_pull"
  //    Handle underscore-separated compound codes
  if (code.includes('_')) {
    const parts = code.split('_');
    return parts.join(' ');
  }

  // 3. Rule-based fallback
  return decompose(code);
}
