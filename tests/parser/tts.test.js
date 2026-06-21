import { describe, it, expect } from 'vitest';
import { parseTTS, parseFullUnit, parseModels, parseWeapons, parseInvuln } from '../../src/parser/tts.js';
import ttsSample from '../fixtures/tts_sample.json';

describe('parseTTS', () => {
  const result = parseTTS(ttsSample);

  it('finds leaders', () => {
    expect(result.leaders.length).toBeGreaterThan(0);
    result.leaders.forEach(l => {
      expect(['Leader', 'Support']).toContain(l.role);
      expect(l.id).toBeTruthy();
      expect(l.name).toBeTruthy();
    });
  });

  it('finds bodyguard groups', () => {
    expect(result.groups.length).toBeGreaterThan(0);
    result.groups.forEach(g => {
      expect(g.uuid).toBeTruthy();
      expect(g.name).toBeTruthy();
      expect(g.models).toBeGreaterThan(0);
      expect(g.indices.length).toBeGreaterThan(0);
    });
  });

  it('finds standalone characters', () => {
    // TTS sample has C'tan (no Leader/Support) — should be in characters
    expect(result.characters.length).toBeGreaterThan(0);
  });

  it('does not put Character units in groups', () => {
    const characterNames = result.characters.map(c => c.name);
    result.groups.forEach(g => {
      expect(characterNames).not.toContain(g.name);
    });
  });

  it('does not include Leader/Support in leader abilities', () => {
    result.leaders.forEach(l => {
      const abilityNames = l.abilities.map(a => a.name);
      expect(abilityNames).not.toContain('Leader');
      expect(abilityNames).not.toContain('Support');
    });
  });

  it('groups units by uuid tag', () => {
    // Every group should either have a uuid: tag or be a solo
    result.groups.forEach(g => {
      expect(g.uuid).toBeTruthy();
    });
  });

  it('assigns string IDs to leaders', () => {
    result.leaders.forEach(l => {
      expect(typeof l.id).toBe('string');
    });
  });
});

describe('parseModels', () => {
  it('parses standard stat line', () => {
    const lua = 'models = {{ m = "8\\"", t = "6", sv = "3+", w = "4", ld = "7+", oc = "2", name = "Lokhust" }},';
    const models = parseModels(lua);
    expect(models).toHaveLength(1);
    expect(models[0].m).toBe('8"');
    expect(models[0].t).toBe('6');
    expect(models[0].sv).toBe('3+');
    expect(models[0].w).toBe('4');
    expect(models[0].ld).toBe('7+');
    expect(models[0].oc).toBe('2');
  });

  it('handles escaped inch mark in movement', () => {
    const lua = 'models = {{ m = "10\\"", t = "5", sv = "4+", w = "2", ld = "6+", oc = "1" }},';
    const models = parseModels(lua);
    expect(models[0].m).toBe('10"');
  });

  it('returns empty array for missing models section', () => {
    expect(parseModels('')).toEqual([]);
    expect(parseModels('no models here')).toEqual([]);
  });
});

describe('parseWeapons', () => {
  it('parses a ranged weapon', () => {
    const lua = `weapons = {{ name = "Staff of light", range = [[18"]], a = "3", bsws = "2+", s = "7", ap = "-2", d = "1", abilities = [[]] }},`;
    const weapons = parseWeapons(lua);
    expect(weapons).toHaveLength(1);
    expect(weapons[0].name).toBe('Staff of light');
    expect(weapons[0].range).toBe('18"');
    expect(weapons[0].a).toBe('3');
  });

  it('parses a melee weapon', () => {
    const lua = `weapons = {{ name = "Close combat weapon", range = [[Melee]], a = "2", bsws = "3+", s = "6", ap = "0", d = "1", abilities = [[]] }},`;
    const weapons = parseWeapons(lua);
    expect(weapons[0].range).toBe('Melee');
  });

  it('returns empty array when no weapons', () => {
    expect(parseWeapons('')).toEqual([]);
  });
});

describe('parseInvuln', () => {
  it('extracts invulnerable save from description', () => {
    const desc = 'some text [56f442]Invulnerable Save:[-] 4+\r\n more text';
    expect(parseInvuln(desc)).toBe('4+');
  });

  it('returns null when no invuln', () => {
    expect(parseInvuln('no invuln here')).toBeNull();
  });
});

describe('parseFullUnit (TTS)', () => {
  it('returns null for missing index', () => {
    expect(parseFullUnit(ttsSample, 9999)).toBeNull();
  });

  it('parses a complete unit', () => {
    const unit = parseFullUnit(ttsSample, 3); // Lokhust Heavy Destroyers
    expect(unit).not.toBeNull();
    expect(unit.name).toBeTruthy();
    expect(unit.models.length).toBeGreaterThan(0);
    expect(unit.weapons.length).toBeGreaterThan(0);
    expect(unit.ownAbilities.length).toBeGreaterThan(0);
    unit.ownAbilities.forEach(ab => {
      expect(ab.name).toBeTruthy();
      expect(typeof ab.desc).toBe('string');
    });
  });

  it('does not include Leader/Support in ownAbilities', () => {
    const leaderObjIdx = parseInt(parseTTS(ttsSample).leaders[0].objIdx);
    const unit = parseFullUnit(ttsSample, leaderObjIdx);
    const names = unit.ownAbilities.map(a => a.name);
    expect(names).not.toContain('Leader');
    expect(names).not.toContain('Support');
  });
});
