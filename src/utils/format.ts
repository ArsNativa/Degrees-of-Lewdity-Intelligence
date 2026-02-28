/**
 * Generic formatting utilities — pure functions, zero game dependencies.
 */

/**
 * Format a number for LLM consumption: round to at most 2 decimal places
 * and strip unnecessary trailing zeros.
 *
 * Examples: 3500 → "3500", 12.345 → "12.35", 1.10 → "1.1".
 */
export function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return parseFloat(n.toFixed(2)).toString();
}

/**
 * Convert raw game pennies to a £-prefixed display string.
 *
 * The game stores money as integer pennies (e.g. 10050 = £100.50).
 * Returns e.g. "£100.50", "£0.00", "£3.20".
 */
export function formatMoney(rawPennies: number): string {
  const pounds = rawPennies / 100;
  return `£${pounds.toFixed(2)}`;
}
