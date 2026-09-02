import type { CommandId } from './types.ts';

export interface ParsedCommand {
  id: CommandId;
  count: number;
}

const SIMPLE_KEYS: Record<string, CommandId> = {
  h: 'h', j: 'j', k: 'k', l: 'l',
  w: 'w', b: 'b', e: 'e',
  $: '$',
  G: 'G',
  p: 'p',
};

// Multi-key sequences, keyed by their full key string in order. Doubled
// chords (gg/dd/yy) are just this table's 2-key case; <space>ff is a 3-key
// one - one mechanism covers both instead of a separate doubled-letter
// special case plus a separate leader-key special case.
const SEQUENCES: Record<string, CommandId> = {
  gg: 'gg',
  dd: 'dd',
  yy: 'yy',
  ' ff': 'ff',
};
const MAX_SEQUENCE_LEN = Math.max(...Object.keys(SEQUENCES).map((s) => s.length));

/**
 * Turns a stream of raw keydown characters into Vim-style commands: digit
 * counts (e.g. "3j"), and multi-key sequences (doubled chords gg/dd/yy,
 * and the leader sequence <space>ff). A key that can't continue any
 * sequence prefix breaks the pending buffer, just like real Vim breaking
 * a chord on an unexpected key.
 */
export class InputBuffer {
  private pendingSequence = '';
  private pendingCount = '';

  /** Returns a completed command, or null while still buffering input. */
  handleKey(key: string): ParsedCommand | null {
    // A leading '0' with no count yet is the "start of line" motion, not a digit.
    if (key >= '1' && key <= '9') {
      this.pendingCount += key;
      return null;
    }
    if (key === '0' && this.pendingCount !== '') {
      this.pendingCount += key;
      return null;
    }

    if (this.pendingSequence) {
      const attempt = this.pendingSequence + key;
      if (attempt in SEQUENCES) {
        this.pendingSequence = '';
        const count = this.consumeCount();
        return { id: SEQUENCES[attempt], count };
      }
      if (this.hasPrefixMatch(attempt)) {
        this.pendingSequence = attempt;
        return null;
      }
      // No sequence still matches; drop the stale buffer and process this
      // key fresh (it may itself start a new sequence, just like a fresh
      // key breaking a chord in real Vim doesn't get swallowed).
      this.pendingSequence = '';
    }

    if (key in SEQUENCES) {
      // Single-char keys that are also a complete sequence on their own
      // don't occur in SEQUENCES today (every entry is 2+ chars), so this
      // branch is unreachable in practice - kept for safety if that changes.
      this.pendingSequence = '';
      const count = this.consumeCount();
      return { id: SEQUENCES[key], count };
    }
    if (this.hasPrefixMatch(key)) {
      this.pendingSequence = key;
      return null;
    }

    if (key === '0') {
      const count = this.consumeCount();
      return { id: '0', count };
    }

    if (key in SIMPLE_KEYS) {
      const count = this.consumeCount();
      return { id: SIMPLE_KEYS[key], count };
    }

    // Unrecognized key: clear any stray count buffer and ignore.
    this.pendingCount = '';
    return null;
  }

  private hasPrefixMatch(prefix: string): boolean {
    if (prefix.length >= MAX_SEQUENCE_LEN) return false;
    return Object.keys(SEQUENCES).some((s) => s.startsWith(prefix));
  }

  private consumeCount(): number {
    const n = this.pendingCount === '' ? 1 : parseInt(this.pendingCount, 10);
    this.pendingCount = '';
    return n;
  }

  get displayBuffer(): string {
    return (this.pendingCount || '') + this.pendingSequence.replace(/ /g, '<space>');
  }
}
