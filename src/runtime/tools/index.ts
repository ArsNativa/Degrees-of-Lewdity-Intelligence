/**
 * Tool registry — aggregates all domain tools into a single tool set
 * consumed by the ReAct agent.
 *
 * File layout mirrors the design document's five-layer taxonomy:
 *   character.ts  — 角色状态层: get_player_status, get_skills, get_clothing_appearance, get_fame_reputation
 *   social.ts     — 社交层:     get_npc_overview, get_npc_detail
 *   world.ts      — 世界状况层: get_world_state, get_active_quests, get_current_scene
 *   inventory.ts  — 物品与经济层: get_wardrobe, get_inventory, get_saved_outfits, get_plants_cooking
 */

// ── Domain imports ──────────────────────────────────────────

import { getPlayerStatus, getSkills, getClothingAppearance, getFameReputation } from './character.js';
import { getWorldState, getCurrentScene, getActiveQuests } from './world.js';
import { getNpcOverview, getNpcDetail } from './social.js';
import { getWardrobe, getInventory, getSavedOutfits, getPlantsCooking } from './inventory.js';

// ── Registry ────────────────────────────────────────────────

/**
 * All tools available to the ReAct agent.
 * This object is passed directly to the AI SDK's `tools` parameter.
 *
 * Tool naming follows snake_case to align with LLM function-calling conventions.
 */
export function createToolSet() {
  return {
    // 角色状态层 (Character)
    get_player_status: getPlayerStatus,
    get_skills: getSkills,
    get_clothing_appearance: getClothingAppearance,
    get_fame_reputation: getFameReputation,
    // 社交层 (Social)
    get_npc_overview: getNpcOverview,
    get_npc_detail: getNpcDetail,
    // 世界状况层 (World & Situation)
    get_world_state: getWorldState,
    get_active_quests: getActiveQuests,
    get_current_scene: getCurrentScene,
    // 物品与经济层 (Inventory & Economy)
    get_wardrobe: getWardrobe,
    get_inventory: getInventory,
    get_saved_outfits: getSavedOutfits,
    get_plants_cooking: getPlantsCooking,
  } as const;
}

/** The type of the tool set for type inference. */
export type AgentToolSet = ReturnType<typeof createToolSet>;

/** Get a human-readable list of available tool names (for logging). */
export function getToolNames(): string[] {
  return Object.keys(createToolSet());
}
