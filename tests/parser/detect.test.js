import { describe, it, expect } from 'vitest';
import { detectFormat } from '../../src/parser/detect.js';
import ttsSample          from '../fixtures/tts_sample.json';
import yellowscribeSample from '../fixtures/yellowscribe_sample.json';

describe('detectFormat', () => {
  it('detects TTS format', () => {
    expect(detectFormat(ttsSample)).toBe('tts');
  });

  it('detects Yellowscribe format', () => {
    expect(detectFormat(yellowscribeSample)).toBe('yellowscribe');
  });

  it('returns null for unknown format', () => {
    expect(detectFormat({})).toBeNull();
    expect(detectFormat({ foo: 'bar' })).toBeNull();
    expect(detectFormat(null)).toBeNull();
  });

  it('requires both units and edition for yellowscribe', () => {
    expect(detectFormat({ units: {} })).toBeNull();
    expect(detectFormat({ edition: '10e' })).toBeNull();
    expect(detectFormat({ units: {}, edition: '10e' })).toBe('yellowscribe');
  });
});
