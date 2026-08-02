import { describe, it, expect } from 'vitest';
import {
  flagFromCode,
  COUNTRY_FLAG_CODES,
  FLAG_EMOJIS,
  COMMON_EMOJI_CANDIDATES,
  ALL_EMOJI_CANDIDATES,
} from '../../../../services/ocr/emoji/emojiSet';

describe('emojiSet', () => {
  describe('flagFromCode', () => {
    it('builds a regional-indicator flag from an ISO code', () => {
      expect(flagFromCode('US')).toBe('\u{1F1FA}\u{1F1F8}');
      expect(flagFromCode('GB')).toBe('\u{1F1EC}\u{1F1E7}');
    });

    it('is case-insensitive', () => {
      expect(flagFromCode('us')).toBe(flagFromCode('US'));
    });

    it('rejects codes that are not 2 letters', () => {
      expect(() => flagFromCode('USA')).toThrow();
      expect(() => flagFromCode('U')).toThrow();
    });
  });

  describe('candidate set', () => {
    it('has a healthy number of candidates', () => {
      expect(COMMON_EMOJI_CANDIDATES.length).toBeGreaterThan(400);
      expect(FLAG_EMOJIS.length).toBeGreaterThan(150);
      expect(ALL_EMOJI_CANDIDATES.length).toBe(COMMON_EMOJI_CANDIDATES.length + FLAG_EMOJIS.length);
    });

    it('contains the emotion/flag staples the feature targets', () => {
      for (const e of ['😀', '❤️', '😂', '👍', '🎉']) {
        expect(ALL_EMOJI_CANDIDATES).toContain(e);
      }
    });

    it('contains all supported flag codes', () => {
      expect(COUNTRY_FLAG_CODES.length).toBe(new Set(COUNTRY_FLAG_CODES).size);
      for (const code of COUNTRY_FLAG_CODES) {
        expect(FLAG_EMOJIS).toContain(flagFromCode(code));
      }
    });

    it('has no duplicate emoji candidates', () => {
      expect(new Set(ALL_EMOJI_CANDIDATES).size).toBe(ALL_EMOJI_CANDIDATES.length);
    });
  });
});
