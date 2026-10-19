/**
 * The run id in a pasted Process Street run link, e.g.
 * `https://app.process.st/runs/Longview-Self-Storage-QMS-Onboarding-misXFuUwTRgBoTtGVj18wA/tasks/...`
 * -- the 22-character id after the run's name, before `/tasks/`. `null`
 * for anything that is not such a link.
 */
export function runIdFromUrl(text: string): string | null {
  const match = text.trim().match(/process\.st\/runs\/[^/?#]*?-([A-Za-z0-9_-]{22})(?:[/?#]|$)/);
  return match ? match[1] : null;
}
