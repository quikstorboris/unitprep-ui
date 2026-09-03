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

/**
 * `"6306500137"` -> `"630-650-0137"` -- for a US 10-digit phone number,
 * however PS stored it (digits only, with dashes/spaces/parens already,
 * with a leading "1", ...). Strips every non-digit first, then formats
 * only if exactly 10 digits remain (11 with a leading "1" also counts,
 * dropping the "1"); anything else (a different country's number, a
 * partial/garbled value) is returned unchanged rather than mangled --
 * this is display formatting, not validation.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const tenDigits = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (tenDigits.length !== 10) return raw;
  return `${tenDigits.slice(0, 3)}-${tenDigits.slice(3, 6)}-${tenDigits.slice(6)}`;
}

/**
 * `"1966-12-09T13:00:00.000Z"` -> `"12-09-1966"` -- date-only, no time.
 * Reads the `YYYY-MM-DD` prefix directly as literal calendar-date text
 * rather than parsing through `Date` and reading local/UTC getters --
 * PS's own date-of-birth values carry an inconsistent, seemingly
 * arbitrary time-of-day component (observed: `13:00:00.000Z` on one
 * real record, `16:00:00.000Z` on another for the same form), so
 * converting through a `Date` object risks shifting the calendar date
 * by a day depending on the reader's timezone. Falls back to the raw
 * value unchanged if it doesn't start with that shape (already
 * date-only, blank, or some other format entirely).
 */
export function formatDateOnly(raw: string | null | undefined): string {
  if (!raw) return "";
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw;
  const [, year, month, day] = match;
  return `${month}-${day}-${year}`;
}
