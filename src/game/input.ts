import type { CommandId } from './types.ts';

export interface ParsedCommand {
  id: CommandId;
  count: number;
}

const CHORD_KEYS: Record<string, CommandId> = { g: 'gg', d: 'dd', y: 'yy' };
const SIMPLE_KEYS: Record<string, CommandId> = {
  h: 'h', j: 'j', k: 'k', l: 'l',
  w: 'w', b: 'b', e: 'e',
  $: '$',
  G: 'G',
  p: 'p',
};

/**
 * Turns a stream of raw keydown characters into Vim-style commands:
 * digit counts (e.g. "3j"), and doubled-letter chords (gg / dd / yy).
 * A different key breaks a pending chord, just like real Vim.
 */
export class InputBuffer {
  private pendingChord: string | null = null;
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

    if (this.pendingChord) {
      const chord = this.pendingChord;
      this.pendingChord = null;
      if (key === chord) {
        const count = this.consumeCount();
        return { id: CHORD_KEYS[chord], count };
      }
      // Any other key cancels the chord; fall through and process this key fresh.
    }

    if (key in CHORD_KEYS) {
      this.pendingChord = key;
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

  private consumeCount(): number {
    const n = this.pendingCount === '' ? 1 : parseInt(this.pendingCount, 10);
    this.pendingCount = '';
    return n;
  }

  get displayBuffer(): string {
    return (this.pendingCount || '') + (this.pendingChord || '');
  }
}
