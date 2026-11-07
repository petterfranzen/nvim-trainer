import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../src/game/escape.ts';

describe('escapeHtml', () => {
  it('neutralises every HTML-significant character', () => {
    expect(escapeHtml(`<script>alert("x&y")</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&amp;y&quot;)&lt;/script&gt;',
    );
  });

  it('escapes the ampersand first, so existing entities are not double-escaped', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
    expect(escapeHtml('&')).toBe('&amp;');
  });

  it('escapes both quote styles', () => {
    expect(escapeHtml('"double"')).toBe('&quot;double&quot;');
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('leaves ordinary text - file names and icons - untouched', () => {
    expect(escapeHtml('config.ts')).toBe('config.ts');
    expect(escapeHtml('\ud83d\udd27')).toBe('\ud83d\udd27');
  });

  it('turns a hostile tag into visible text, never markup', () => {
    const out = escapeHtml('<img src=x onerror=alert(1)>');
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).toContain('&lt;img');
  });
});
