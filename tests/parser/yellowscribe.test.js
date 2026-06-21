import { describe, it, expect } from 'vitest';
import { parseYellowscribe, parseFullUnit } from '../../src/parser/yellowscribe.js';
import sample from '../fixtures/yellowscribe_sample.json';

describe('parseYellowscribe', () => {
  const result = parseYellowscribe(sample);

  it('finds leaders', () => {
    expect(result.leaders).toHaveLength(2);
    result.leaders.forEach(l => {
      expect(l.role).toBe('Leader');
      expect(l.id).toBeTruthy();
      expect(l.name).toBeTruthy();
    });
  });

  it('uses uuid as leader ID', () => {
    const ids = result.leaders.map(l => l.id);
    expect(ids).toContain('ldr1');
    expect(ids).toContain('ldr2');
  });

  it('finds bodyguard groups', () => {
    expect(result.groups).toHaveLength(2);
    result.groups.forEach(g => {
      expect(g.uuid).toBeTruthy();
      expect(g.models).toBeGreaterThan(0);
    });
  });

  it('finds standalone characters', () => {
    expect(result.characters).toHaveLength(1);
    expect(result.characters[0].name).toBe("C'tan Shard");
    expect(result.characters[0].objIdx).toBe('char1');
  });

  it('excludes Leader keyword from leader abilities', () => {
    result.leaders.forEach(l => {
      const names = l.abilities.map(a => a.name);
      expect(names).not.toContain('Leader');
      expect(names).not.toContain('Support');
    });
  });

  it('excludes Invulnerable Save from own abilities', () => {
    result.leaders.forEach(l => {
      l.abilities.forEach(ab => {
        expect(ab.name).not.toMatch(/^Invulnerable Save/);
      });
    });
  });

  it('preserves order from order array', () => {
    // ldr1 before ldr2
    const leaderIds = result.leaders.map(l => l.id);
    expect(leaderIds.indexOf('ldr1')).toBeLessThan(leaderIds.indexOf('ldr2'));
  });

  it('includes ability descriptions', () => {
    const lord = result.leaders.find(l => l.id === 'ldr1');
    const resOrb = lord.abilities.find(a => a.name === 'Resurrection Orb');
    expect(resOrb.desc).toBe('Resurrect D6 wounds.');
  });

  it('counts models correctly', () => {
    const warriors = result.groups.find(g => g.uuid === 'grp2');
    expect(warriors.models).toBe(20);
    const destroyers = result.groups.find(g => g.uuid === 'grp1');
    expect(destroyers.models).toBe(3);
  });
});

describe('parseFullUnit (Yellowscribe)', () => {
  it('returns null for unknown uuid', () => {
    expect(parseFullUnit(sample, 'nonexistent')).toBeNull();
  });

  it('parses stats correctly', () => {
    const unit = parseFullUnit(sample, 'ldr1');
    expect(unit.models).toHaveLength(1);
    expect(unit.models[0].m).toBe('8"');
    expect(unit.models[0].t).toBe('6');
    expect(unit.models[0].sv).toBe('3+');
  });

  it('parses weapons', () => {
    const unit = parseFullUnit(sample, 'grp1');
    expect(unit.weapons).toHaveLength(1);
    expect(unit.weapons[0].name).toBe('Enmitic exterminator');
    expect(unit.weapons[0].range).toBe('36"');
    expect(unit.weapons[0].abilities).toBe('Heavy, Rapid Fire 6');
  });

  it('parses own abilities without invuln or Leader', () => {
    const unit = parseFullUnit(sample, 'ldr1');
    const names = unit.ownAbilities.map(a => a.name);
    expect(names).not.toContain('Leader');
    expect(names).toContain('Resurrection Orb');
    expect(names).toContain('Destroyer Cult');
  });

  it('includes faction and keywords', () => {
    const unit = parseFullUnit(sample, 'grp2');
    expect(unit.faction).toBe('Necrons');
    expect(unit.keywords).toContain('Necron Warriors');
  });

  it('returns empty inhAbilities (no TTS description)', () => {
    const unit = parseFullUnit(sample, 'grp1');
    expect(unit.inhAbilities).toEqual([]);
  });
});
