/**
 * `"unit 13"` for one, `"units 54, 67, and 77"` (Oxford comma) for
 * more — mirrors `unitprep-dedup`'s own `units_phrase` so "unit"/"units"
 * always agrees with how many are actually listed, wherever a raw unit
 * list needs formatting client-side (the backend already returns fully
 * composed phrases inside note/sentence text, but a few UI spots — the
 * flagged-group header, the typo-variant table — build the phrase from
 * a raw `units: string[]` instead).
 */
export function formatUnits(units: string[]): string {
  if (units.length === 0) {
    return "no units";
  }

  if (units.length === 1) {
    return `unit ${units[0]}`;
  }

  return `units ${oxfordJoin(units)}`;
}

function oxfordJoin(items: string[]): string {
  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  const last = items[items.length - 1];
  const rest = items.slice(0, -1);
  return `${rest.join(", ")}, and ${last}`;
}
