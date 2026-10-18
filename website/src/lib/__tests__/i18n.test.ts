import { describe, expect, it } from 'vitest';
import { detectLang, STRINGS, translate } from '../i18n';

describe('i18n', () => {
  it('exposes identical keys for tr and en', () => {
    expect(Object.keys(STRINGS.en).sort()).toEqual(Object.keys(STRINGS.tr).sort());
  });

  it('interpolates variables', () => {
    expect(translate('tr', 'session_counter', { n: 2 })).toBe('Oturum 2/4');
    expect(translate('en', 'stats', { n: 3 })).toBe('Completed today: 3');
  });

  it('detects Turkish from the browser language and defaults to English', () => {
    expect(detectLang('tr-TR')).toBe('tr');
    expect(detectLang('tr')).toBe('tr');
    expect(detectLang('en-US')).toBe('en');
    expect(detectLang('de-DE')).toBe('en');
  });
});
