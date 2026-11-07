import { describe, it, expect } from 'vitest';
import { InputBuffer } from '../src/game/input.ts';

function feed(keys: string[]) {
  const buffer = new InputBuffer();
  return keys.map((k) => buffer.handleKey(k));
}

describe('InputBuffer', () => {
  it('turns a plain motion key into a count-1 command', () => {
    expect(feed(['h'])).toEqual([{ id: 'h', count: 1 }]);
    expect(feed(['G'])[0]).toEqual({ id: 'G', count: 1 });
    expect(feed(['$'])[0]).toEqual({ id: '$', count: 1 });
    expect(feed(['p'])[0]).toEqual({ id: 'p', count: 1 });
  });

  it('buffers a digit count and applies it to the next command', () => {
    expect(feed(['3', 'j'])).toEqual([null, { id: 'j', count: 3 }]);
    expect(feed(['9', 'l'])[1]).toEqual({ id: 'l', count: 9 });
  });

  it('treats a 0 after a digit as part of the count, not the start-of-line motion', () => {
    expect(feed(['1', '0', 'j'])).toEqual([null, null, { id: 'j', count: 10 }]);
  });

  it('treats a leading 0 on its own as the start-of-line motion', () => {
    expect(feed(['0'])).toEqual([{ id: '0', count: 1 }]);
  });

  it('recognises the doubled chords gg, dd and yy', () => {
    expect(feed(['g', 'g'])).toEqual([null, { id: 'gg', count: 1 }]);
    expect(feed(['d', 'd'])).toEqual([null, { id: 'dd', count: 1 }]);
    expect(feed(['y', 'y'])).toEqual([null, { id: 'yy', count: 1 }]);
  });

  it('applies a pending count to a doubled chord', () => {
    expect(feed(['2', 'd', 'd'])[2]).toEqual({ id: 'dd', count: 2 });
    expect(feed(['5', 'y', 'y'])[2]).toEqual({ id: 'yy', count: 5 });
  });

  it('recognises the <space>ff leader sequence', () => {
    expect(feed([' ', 'f', 'f'])).toEqual([null, null, { id: 'ff', count: 1 }]);
  });

  it('drops a broken chord without swallowing the key that broke it', () => {
    // 'g' starts gg; 'l' cannot continue it, so the buffer resets and 'l'
    // is processed fresh - exactly as a stray key breaks a chord in Vim.
    expect(feed(['g', 'l'])).toEqual([null, { id: 'l', count: 1 }]);
    // and the buffer is clean afterwards: a fresh gg still works
    expect(feed(['g', 'x', 'g', 'g'])).toEqual([null, null, null, { id: 'gg', count: 1 }]);
  });

  it('clears a stray count when an unrecognised key interrupts it', () => {
    expect(feed(['3', 'x', 'j'])).toEqual([null, null, { id: 'j', count: 1 }]);
  });

  it('shows the pending buffer, rendering the leader space as <space>', () => {
    const buffer = new InputBuffer();
    buffer.handleKey('3');
    buffer.handleKey('g');
    expect(buffer.displayBuffer).toBe('3g');
    buffer.handleKey('x'); // clears both pending pieces
    buffer.handleKey(' ');
    buffer.handleKey('f');
    expect(buffer.displayBuffer).toBe('<space>f');
  });
});
