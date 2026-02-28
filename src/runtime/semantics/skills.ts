/**
 * Skill semantic mappings — value → label for skills & school grades.
 *
 * Thresholds verified against:
 * - DOL/game/base-system/overlays/characteristics.twee
 *   `_basicSkillGrades` and `_detailedSkillGrades`
 * - DOL/game/base-system/overlays/characteristics.twee L868–876 (subject grades)
 *
 * Pure functions — no side effects, no external dependencies.
 */
import { fmtNum } from '../../utils/format.js';

// ── Basic Skill Grade (7-tier) ───────────────────────────────
// Source: characteristics.twee `_basicSkillGrades`
// Used for: sex skills (oral, vaginal, anal, hand, etc.)

/**
 * Map a 0–1000 skill value to a basic letter grade.
 *
 * Thresholds: 0→None, 1→F, 200→D, 400→C, 600→B, 800→A, 1000→S.
 */
export function skillGrade(value: number): string {
  let grade: string;
  if (value >= 1000) grade = 'S';
  else if (value >= 800) grade = 'A';
  else if (value >= 600) grade = 'B';
  else if (value >= 400) grade = 'C';
  else if (value >= 200) grade = 'D';
  else if (value >= 1) grade = 'F';
  else grade = 'None';
  return `${grade} (${fmtNum(value)})`;
}

// ── Detailed Skill Grade ──────────────────────────────────────
// Source: characteristics.twee `_detailedSkillGrades`
// Used for: general skills (skulduggery, dancing, swimming, etc.)

/**
 * Map a 0–1000 skill value to a detailed letter grade.
 *
 * Thresholds: 0→None, 1→F, 100→F+, 200→D, 300→D+, 400→C, 500→C+,
 * 600→B, 700→B+, 800→A, 900→A+, 1000→S.
 */
export function detailedSkillGrade(value: number): string {
  let grade: string;
  if (value >= 1000) grade = 'S';
  else if (value >= 900) grade = 'A+';
  else if (value >= 800) grade = 'A';
  else if (value >= 700) grade = 'B+';
  else if (value >= 600) grade = 'B';
  else if (value >= 500) grade = 'C+';
  else if (value >= 400) grade = 'C';
  else if (value >= 300) grade = 'D+';
  else if (value >= 200) grade = 'D';
  else if (value >= 100) grade = 'F+';
  else if (value >= 1) grade = 'F';
  else grade = 'None';
  return `${grade} (${fmtNum(value)})`;
}

// ── School Subject Grade ─────────────────────────────────────
// Source: characteristics.twee L868–876 subject trait → letter mapping

/**
 * Map school subject trait value → letter grade.
 *
 * -1→F, 0→D, 1→C, 2→B, 3→A, ≥4→A*.
 */
export function subjectGrade(trait: number): string {
  if (trait >= 4) return 'A*';
  if (trait >= 3) return 'A';
  if (trait >= 2) return 'B';
  if (trait >= 1) return 'C';
  if (trait >= 0) return 'D';
  return 'F';
}
