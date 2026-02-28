/**
 * Inventory & Economy Tools — 物品与经济层 (Inventory & Economy)
 *
 * get_wardrobe       — 衣柜概览/按条件查询
 * get_inventory      — 随身物品/装备/消耗品
 * get_saved_outfits  — 套装预设
 * get_plants_cooking — 植物/食材/种植/食谱
 *
 * All tools are read-only.
 */
import { tool, jsonSchema } from 'ai';
import { toolLogger as logger } from './helpers.js';
import { safeRead, getV, getSetup, getTime } from '../access.js';
import { skillGrade } from '../semantics/index.js';

// ═══════════════════════════════════════════════════════════
// get_wardrobe
// ═══════════════════════════════════════════════════════════

const wardrobeParams = jsonSchema<{
  wardrobeKey?: string;
  slot?: string;
  clothingType?: string;
  damaged?: boolean;
}>({
  type: 'object' as const,
  properties: {
    wardrobeKey: {
      type: 'string' as const,
      description:
        'Optional. "wardrobe" for home wardrobe, or a location key like "edensCabin", "asylum", "alexFarm". Omit for summary of all wardrobes.',
    },
    slot: {
      type: 'string' as const,
      description:
        'Optional (detail mode only). Filter by clothing slot, e.g. "upper", "lower", "legs", "feet".',
    },
    clothingType: {
      type: 'string' as const,
      description:
        'Optional (detail mode only). Filter by clothing type: "normal", "school", "swim", "sleep", "formal", "costume", "maid", "holy".',
    },
    damaged: {
      type: 'boolean' as const,
      description:
        'Optional (detail mode only). If true, only return damaged clothing (integrity < max).',
    },
  },
});

/** Map internal wardrobe key → human-readable label. */
const WARDROBE_LABELS: Record<string, string> = {
  wardrobe: 'Home',
  edensCabin: "Eden's Cabin",
  asylum: 'Asylum',
  alexFarm: "Alex's Farm",
  prison: 'Prison',
  avery_mansion: "Avery's Mansion",
  birdTower: 'Bird Tower',
  stripClub: 'Strip Club',
  brothel: 'Brothel',
  school: 'School',
  lake: 'Lake',
  beach: 'Beach',
  spa: 'Spa',
  temple: 'Temple',
  church: 'Church',
};

export const getWardrobe = tool({
  description: [
    'Get wardrobe information. Without parameters, returns a summary of all wardrobes',
    '(capacity, item count, mode). With wardrobeKey, returns detailed contents of that',
    'wardrobe, optionally filtered by slot, clothingType, or damaged status.',
    'Use this when the user asks about their wardrobe, clothing storage, or "what clothes do I have".',
  ].join(' '),
  inputSchema: wardrobeParams,
  execute: async ({ wardrobeKey, slot, clothingType, damaged }) => {
    logger.info('Executing get_wardrobe', { wardrobeKey, slot, clothingType, damaged });

    const V = getV();
    const setup = getSetup();
    if (!V) return { _mock: true, _note: 'Game state not available' };

    const allSlots: string[] = safeRead(
      () => setup?.clothes_all_slots,
      ['over_upper', 'over_lower', 'over_head', 'upper', 'lower', 'under_upper', 'under_lower',
       'head', 'face', 'neck', 'hands', 'handheld', 'legs', 'feet', 'genitals'],
    );
    const slotCount = allSlots.length;

    // ── Summary mode ──
    if (!wardrobeKey) {
      const mode = safeRead(() => V.settings?.multipleWardrobes, false);
      const wardrobeMode = mode === 'all' ? 'all' : mode === 'isolated' ? 'isolated' : 'single';

      const summaries: Array<Record<string, any>> = [];

      // Main wardrobe
      const mainSpace = safeRead(() => V.wardrobe?.space, 10);
      let mainTotal = 0;
      for (const s of allSlots) {
        mainTotal += safeRead(() => V.wardrobe?.[s]?.length, 0);
      }
      summaries.push({
        key: 'wardrobe',
        label: 'Home',
        unlocked: true,
        isolated: false,
        totalItems: mainTotal,
        capacity: mainSpace * slotCount,
        spacePerSlot: mainSpace,
      });

      // Location wardrobes
      const wardrobes = safeRead(() => V.wardrobes, {});
      for (const key of Object.keys(wardrobes)) {
        if (key === 'shopReturn') continue; // metadata, not a wardrobe
        const wd = wardrobes[key];
        if (!wd || typeof wd !== 'object') continue;
        const space = safeRead(() => wd.space, 10);
        let total = 0;
        for (const s of allSlots) {
          total += safeRead(() => wd[s]?.length, 0);
        }
        summaries.push({
          key,
          label: WARDROBE_LABELS[key] ?? key,
          unlocked: safeRead(() => wd.unlocked, false),
          isolated: safeRead(() => wd.isolated, false),
          totalItems: total,
          capacity: space * slotCount,
          spacePerSlot: space,
        });
      }

      return {
        wardrobeMode,
        shopReturnDestination: safeRead(() => V.wardrobes?.shopReturn, null),
        wardrobes: summaries,
        hint: 'Pass wardrobeKey parameter to see detailed contents of a specific wardrobe.',
      };
    }

    // ── Detail mode ──
    // Resolve wardrobe data source
    let wd: Record<string, any> | null = null;
    let label = WARDROBE_LABELS[wardrobeKey] ?? wardrobeKey;
    let isolated = false;
    let unlocked = true;
    let spacePerSlot = 10;

    if (wardrobeKey === 'wardrobe') {
      wd = safeRead(() => V.wardrobe, null);
      spacePerSlot = safeRead(() => wd?.space, 10);
    } else {
      const locWd = safeRead(() => V.wardrobes?.[wardrobeKey], null);
      if (!locWd) {
        return { error: `Wardrobe "${wardrobeKey}" not found.` };
      }
      wd = locWd;
      isolated = safeRead(() => locWd.isolated, false);
      unlocked = safeRead(() => locWd.unlocked, false);
      spacePerSlot = safeRead(() => locWd.space, 10);
    }

    if (!wd) return { error: `Wardrobe "${wardrobeKey}" data not available.` };

    const clothingDataFn = (window as any)?.clothingData as
      ((s: string, item: any, prop: string) => any) | undefined;

    const slotsToScan = slot ? [slot] : allSlots;
    const result: Record<string, Array<Record<string, any>>> = {};
    let matchedItems = 0;

    for (const s of slotsToScan) {
      const items: any[] = safeRead(() => wd![s], []);
      if (!Array.isArray(items) || items.length === 0) continue;

      const filtered: Array<Record<string, any>> = [];
      for (const item of items) {
        if (!item || !item.name || item.name === 'naked') continue;

        // Type filter — type may be trimmed; fall back to setup.clothes
        let itemType: string[] = item.type ?? [];
        if ((!itemType || itemType.length === 0) && typeof clothingDataFn === 'function') {
          itemType = safeRead(() => clothingDataFn!(s, item, 'type'), []) ?? [];
        }
        if (clothingType && !itemType.includes(clothingType)) continue;

        // Integrity filter
        const intMax = typeof clothingDataFn === 'function'
          ? safeRead(() => clothingDataFn!(s, item, 'integrity_max'), item.integrity_max ?? 100)
          : (item.integrity_max ?? 100);
        const intCurrent = item.integrity ?? intMax;

        if (damaged === true && intCurrent >= intMax) continue;

        filtered.push({
          name: item.name,
          colour: item.colour || undefined,
          type: itemType,
          integrity: integrityLabel(intCurrent, intMax),
        });
      }

      if (filtered.length > 0) {
        result[s] = filtered;
        matchedItems += filtered.length;
      }
    }

    return {
      key: wardrobeKey,
      label,
      unlocked,
      isolated,
      spacePerSlot,
      filters: {
        slot: slot ?? null,
        clothingType: clothingType ?? null,
        damaged: damaged ?? null,
      },
      slots: result,
      matchedItems,
    };
  },
});

// ═══════════════════════════════════════════════════════════
// get_inventory
// ═══════════════════════════════════════════════════════════

const inventoryParams = jsonSchema<{
  category?: 'carried' | 'misc' | 'chastity' | 'condoms' | 'sextoys';
}>({
  type: 'object' as const,
  properties: {
    category: {
      type: 'string' as const,
      enum: ['carried', 'misc', 'chastity', 'condoms', 'sextoys'],
      description:
        'Optional. Filter by category. Omit to return all five categories.',
    },
  },
});

export const getInventory = tool({
  description: [
    'Get the player\'s current inventory: temporarily carried clothing (stripped during events),',
    'misc items (pepper spray, sewing kit, police card), chastity devices,',
    'condom stock & status, and sex toys (owned/carried/worn).',
    'Use this when the user asks "what do I have", "do I have spray", "condoms", etc.',
  ].join(' '),
  inputSchema: inventoryParams,
  execute: async ({ category }) => {
    logger.info('Executing get_inventory', { category });

    const V = getV();
    const setup = getSetup();
    if (!V) return { _mock: true, _note: 'Game state not available' };

    const allSlots: string[] = safeRead(
      () => setup?.clothes_all_slots,
      ['over_upper', 'over_lower', 'over_head', 'upper', 'lower', 'under_upper', 'under_lower',
       'head', 'face', 'neck', 'hands', 'handheld', 'legs', 'feet', 'genitals'],
    );
    const wardrobeSkip: string[] = safeRead(() => setup?.wardrobeSkip, []);

    const result: Record<string, any> = {};

    // 1. Carried clothing
    if (!category || category === 'carried') {
      const carried: Array<{ slot: string; name: string; colour: string }> = [];
      for (const s of allSlots) {
        const item = safeRead(() => V.carried?.[s], null);
        if (item && item.name && item.name !== 'naked' && !wardrobeSkip.includes(item.name)) {
          carried.push({ slot: s, name: item.name, colour: item.colour || '' });
        }
      }
      result.carriedClothing = carried;
    }

    // 2. Misc items
    if (!category || category === 'misc') {
      const sprayMax = safeRead(() => V.spraymax, 0);
      result.miscItems = {
        pepperSpray: sprayMax > 0
          ? { charges: safeRead(() => V.spray, 0), maxCharges: sprayMax }
          : null,
        sewingKit: safeRead(() => V.sewingKit, 0) >= 1,
        policeAccessCard: safeRead(() => V.police_access_card, 0) >= 1,
        policeCollar: safeRead(() => V.worn?.neck?.collaredpolice, 0) >= 1,
      };
    }

    // 3. Chastity
    if (!category || category === 'chastity') {
      result.chastity = {
        vaginal: safeRead(() => V.vaginalchastity, 0) >= 1,
        anal: safeRead(() => V.analchastity, 0) >= 1,
        penile: safeRead(() => V.penilechastity, 0) >= 1,
      };
    }

    // 4. Condoms
    if (!category || category === 'condoms') {
      const condom = safeRead(() => V.player?.condom, false);
      result.condoms = {
        owned: safeRead(() => V.condoms, 0) ?? 0,
        wearing: !!condom && condom !== false,
        wearingState: condom && typeof condom === 'object'
          ? (condom.state ?? 'normal')
          : null,
      };
    }

    // 5. Sextoys
    if (!category || category === 'sextoys') {
      const toysMap: Record<string, any[]> = safeRead(
        () => V.player?.inventory?.sextoys, {},
      );
      let totalOwned = 0;
      let totalCarried = 0;
      const items: Array<{ name: string; count: number; carried: number; worn: number }> = [];

      for (const [name, instances] of Object.entries(toysMap)) {
        if (!Array.isArray(instances) || instances.length === 0) continue;
        let c = 0;
        let w = 0;
        for (const inst of instances) {
          if (inst?.carried) c++;
          if (inst?.worn) w++;
        }
        totalOwned += instances.length;
        totalCarried += c;
        items.push({ name, count: instances.length, carried: c, worn: w });
      }

      result.sextoys = { totalOwned, totalCarried, items };
    }

    return result;
  },
});

// ═══════════════════════════════════════════════════════════
// get_saved_outfits
// ═══════════════════════════════════════════════════════════

const outfitParams = jsonSchema<{
  outfitType?: 'normal' | 'sleep' | 'swim' | 'school';
  wardrobeKey?: string;
}>({
  type: 'object' as const,
  properties: {
    outfitType: {
      type: 'string' as const,
      enum: ['normal', 'sleep', 'swim', 'school'],
      description: 'Optional. Filter outfits by type.',
    },
    wardrobeKey: {
      type: 'string' as const,
      description:
        'Optional. Filter outfits by bound wardrobe location. Returns outfits bound to this location plus unbound outfits.',
    },
  },
});

export const getSavedOutfits = tool({
  description: [
    'Get the player\'s saved outfit presets. Shows name, type, bound wardrobe,',
    'and which clothing items are part of each outfit.',
    'Use this when the user asks about their saved outfits, "what outfits do I have",',
    'or "which outfit has school clothes".',
  ].join(' '),
  inputSchema: outfitParams,
  execute: async ({ outfitType, wardrobeKey }) => {
    logger.info('Executing get_saved_outfits', { outfitType, wardrobeKey });

    const V = getV();
    const setup = getSetup();
    if (!V) return { _mock: true, _note: 'Game state not available' };

    const allSlots: string[] = safeRead(
      () => setup?.clothes_all_slots,
      ['over_upper', 'over_lower', 'over_head', 'upper', 'lower', 'under_upper', 'under_lower',
       'head', 'face', 'neck', 'hands', 'handheld', 'legs', 'feet', 'genitals'],
    );

    // Current outfit match
    let currentOutfitName: string | null = null;
    try {
      const fn = (window as any)?.currentOutfit;
      if (typeof fn === 'function') {
        const r = fn();
        currentOutfitName = r && r !== 'none' ? r : null;
      }
    } catch { /* ignore */ }

    const outfitArr: any[] = safeRead(() => V.outfit, []);
    const outfits: Array<Record<string, any>> = [];

    for (let i = 0; i < outfitArr.length; i++) {
      const o = outfitArr[i];
      if (!o || !o.name) continue;

      const type = Array.isArray(o.type) && o.type.length > 0 ? o.type[0] : 'normal';
      const location: string | null = o.location ?? null;

      // Type filter
      if (outfitType && type !== outfitType) continue;

      // Wardrobe filter: include outfits bound to this wardrobe OR unbound
      if (wardrobeKey && location && location !== wardrobeKey) continue;

      // Build non-naked slot map
      const items: Record<string, string> = {};
      for (const s of allSlots) {
        const val = o[s] ?? 'naked';
        if (val !== 'naked') items[s] = val;
      }

      outfits.push({
        index: o.index ?? i,
        name: o.name,
        type,
        location,
        hasColors: !!o.colors && o.colors !== false,
        hasHairStyle: !!o.hairStyle,
        items,
      });
    }

    return {
      currentOutfit: currentOutfitName,
      totalSaved: outfitArr.length,
      outfits,
    };
  },
});

// ═══════════════════════════════════════════════════════════
// get_plants_cooking
// ═══════════════════════════════════════════════════════════

const plantsParams = jsonSchema<{
  category?: 'owned' | 'plots' | 'recipes';
  plantType?: string;
  plotLocation?: string;
}>({
  type: 'object' as const,
  properties: {
    category: {
      type: 'string' as const,
      enum: ['owned', 'plots', 'recipes'],
      description:
        'Optional. "owned" = plants/ingredients you have, "plots" = planting plots status, "recipes" = learned recipes. Omit for all.',
    },
    plantType: {
      type: 'string' as const,
      description:
        'Optional (owned only). Filter by type: "flower", "fruit", "vegetable", "shroom", "produce", "ingredient", "food", "meat", "seafood".',
    },
    plotLocation: {
      type: 'string' as const,
      description:
        'Optional (plots only). Filter by location: "garden", "farm", "eden", "wolf", "asylum".',
    },
  },
});

const STAGE_NAMES = ['empty', 'planted', 'sprout', 'seedling', 'budding', 'ready'] as const;

export const getPlantsCooking = tool({
  description: [
    'Get information about plants, ingredients, gardening plots, and cooking recipes.',
    'Without parameters returns all: owned items, plot status, and learned recipes.',
    'Use this when the user asks about food, ingredients, gardening, "what can I cook",',
    'or planting progress.',
  ].join(' '),
  inputSchema: plantsParams,
  execute: async ({ category, plantType, plotLocation }) => {
    logger.info('Executing get_plants_cooking', { category, plantType, plotLocation });

    const V = getV();
    const setup = getSetup();
    const T = getTime();
    if (!V || !setup) return { _mock: true, _note: 'Game state not available' };

    const setupPlants: Record<string, any> = safeRead(() => setup.plants, {});
    const vPlants: Record<string, any> = safeRead(() => V.plants, {});

    const result: Record<string, any> = {};

    // ── Owned ──
    if (!category || category === 'owned') {
      const owned: Array<{ key: string; name: string; amount: number; type: string; bed: string }> = [];
      let ownedTotal = 0;

      for (const [key, sp] of Object.entries(setupPlants)) {
        const amount = safeRead(() => vPlants[key]?.amount, 0);
        if (amount <= 0) continue;
        const type = (sp as any)?.type ?? 'unknown';
        if (plantType && type !== plantType) continue;

        owned.push({
          key,
          name: safeRead(() => vPlants[key]?.plural ?? (sp as any)?.plural ?? key, key),
          amount,
          type,
          bed: (sp as any)?.bed ?? 'unknown',
        });
        ownedTotal += amount;
      }

      result.owned = owned;
      result.ownedTotal = ownedTotal;
    }

    // ── Plots ──
    if (!category || category === 'plots') {
      const plots: Record<string, Array<Record<string, any>>> = {};
      const vPlots: Record<string, any[]> = safeRead(() => V.plots, {});

      for (const [loc, plotArr] of Object.entries(vPlots)) {
        if (plotLocation && loc !== plotLocation) continue;
        if (!Array.isArray(plotArr)) continue;

        const locPlots: Array<Record<string, any>> = [];
        for (let i = 0; i < plotArr.length; i++) {
          const p = plotArr[i];
          if (!p) continue;
          const stageNum = safeRead(() => p.stage, 0);
          locPlots.push({
            index: i,
            plant: safeRead(() => p.plant, 'none') || 'none',
            stage: STAGE_NAMES[Math.min(stageNum, STAGE_NAMES.length - 1)] ?? 'unknown',
            watered: safeRead(() => p.water, false),
            tilled: safeRead(() => p.till, false),
            quality: qualityLabel(safeRead(() => p.quality, 0)),
            size: sizeLabel(safeRead(() => p.size, 0)),
          });
        }
        if (locPlots.length > 0) plots[loc] = locPlots;
      }

      result.plots = plots;
    }

    // ── Recipes ──
    if (!category || category === 'recipes') {
      const recipes: Array<Record<string, any>> = [];
      let recipesLearned = 0;

      for (const [key, sp] of Object.entries(setupPlants)) {
        const spAny = sp as any;
        // Recipes: kitchen-bed items with ingredients
        if (spAny.bed !== 'kitchen' || !Array.isArray(spAny.ingredients) || spAny.ingredients.length === 0) continue;

        const learned = safeRead(() => vPlants[key]?.recipe, false) === true;
        if (!learned) continue;
        recipesLearned++;

        // Check if all ingredients are available
        let canCook = true;
        const ingredients: string[] = spAny.ingredients;
        for (const ing of ingredients) {
          if (safeRead(() => vPlants[ing]?.amount, 0) < 1) {
            canCook = false;
            break;
          }
        }

        recipes.push({
          key,
          name: safeRead(() => spAny.recipe_name ?? spAny.plural ?? key, key),
          difficulty: safeRead(() => spAny.difficulty, 1),
          ingredients,
          canCook,
        });
      }

      result.recipes = recipes;
      result.recipesLearned = recipesLearned;
    }

    // ── Meta ──
    result.meta = {
      knownSeeds: safeRead(() => V.plants_known?.length, 0),
      tendingSkill: {
        value: safeRead(() => V.tending, 0),
        grade: skillGrade(safeRead(() => V.tending, 0)),
      },
      housekeepingSkill: {
        value: safeRead(() => V.housekeeping, 0),
        grade: skillGrade(safeRead(() => V.housekeeping, 0)),
      },
      season: safeRead(() => T?.season, 'unknown'),
      hasGreenhouse: safeRead(() => V.alex_greenhouse, 0) >= 3,
      fertiliser: safeRead(() => V.fertiliser?.current, 0),
    };

    return result;
  },
});

// ═══════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════

function integrityLabel(integrity: number, max: number): string {
  if (max <= 0) return 'unknown';
  const ratio = integrity / max;
  if (ratio >= 1) return 'full';
  if (ratio >= 0.6) return 'frayed';
  if (ratio >= 0.3) return 'torn';
  return 'tattered';
}

function qualityLabel(q: number): string {
  if (q >= 3) return 'excellent';
  if (q >= 2) return 'good';
  if (q >= 1) return 'decent';
  return 'poor';
}

function sizeLabel(s: number): string {
  if (s >= 2) return 'large';
  if (s >= 1) return 'medium';
  return 'small';
}
