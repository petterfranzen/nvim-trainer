/**
 * Escapes a string so it can be interpolated into one of the game's innerHTML
 * templates without becoming markup. The five substitutions cover every way
 * text can break out of an HTML text node or a double/single-quoted attribute
 * value; `&` goes first so the ampersands the later passes introduce aren't
 * double-escaped.
 *
 * Every value that reaches a template literal assigned to .innerHTML goes
 * through this - level titles, hints, file names and icons, command
 * descriptions, and the one genuinely untrusted input, the fuzzy-finder query
 * (typed live, one character at a time).
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
