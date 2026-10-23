/**
 * Characters a QMS tag key may contain: letters, digits, ,  and 
 * (e.g. , , ). Braces are excluded on purpose:
 * the editor wraps every key in  itself, so a typed brace would
 * produce keys like .
 */
const DISALLOWED_TAG_KEY_CHARACTERS = /[^A-Za-z0-9.+-]/g;

/** Drops every character that is not allowed in a QMS tag key (also covers paste). */
export function sanitizeQmsTagKey(raw: string): string {
  return raw.replace(DISALLOWED_TAG_KEY_CHARACTERS, "");
}
