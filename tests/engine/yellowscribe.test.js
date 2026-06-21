import { describe, it, expect } from 'vitest';
import { generateYellowscribe } from '../../src/engine/yellowscribe.js';
import { parseYellowscribe } from '../../src/parser/yellowscribe.js';
import { parseTTS } from '../../src/parser/tts.js';
import ysSample  from '../fixtures/yellowscribe_sample.json';
import ttsSample from '../fixtures/tts_sample.json';

// ── Yellowscribe input ────────────────────────────────────────────────────

describe('generateYellowscribe (yellowscribe input)', () => {
  const { leaders, groups, characters } = parseYellowscribe(ysSample);
  const baseState = {
    leaders, groups, characters,
    attachments:       new Map(),
    excludedAbilities: new Map(),
  };

  it('returns valid Yellowscribe structure', () => {
    const out = generateYellowscribe(ysSample, 'yellowscribe', baseState);
    expect(out).toHaveProperty('edition');
    expect(out).toHaveProperty('order');
    expect(out).toHaveProperty('units');
    expect(Array.isArray(out.order)).toBe(true);
    expect(typeof out.units).toBe('object');
  });

  it('preserves original edition', () => {
    const out = generateYellowscribe(ysSample, 'yellowscribe', baseState);
    expect(out.edition).toBe(ysSample.edition);
  });

  it('does not mutate raw data', () => {
    const before = JSON.stringify(ysSample);
    generateYellowscribe(ysSample, 'yellowscribe', baseState);
    expect(JSON.stringify(ysSample)).toBe(before);
  });

  it('removes excluded ability from unit abilities object', () => {
    const excludedAbilities = new Map([['grp1', new Set(['Optimised For Slaughter'])]]);
    const out = generateYellowscribe(ysSample, 'yellowscribe', { ...baseState, excludedAbilities });
    expect(out.units['grp1'].abilities).not.toHaveProperty('Optimised For Slaughter');
  });

  it('removes excluded ability from model ability list', () => {
    const excludedAbilities = new Map([['grp1', new Set(['Optimised For Slaughter'])]]);
    const out = generateYellowscribe(ysSample, 'yellowscribe', { ...baseState, excludedAbilities });
    const modelAbils = Object.values(out.units['grp1'].models.models)[0].abilities;
    expect(modelAbils).not.toContain('Optimised For Slaughter');
  });

  it('keeps non-excluded abilities intact', () => {
    const excludedAbilities = new Map([['grp1', new Set(['Optimised For Slaughter'])]]);
    const out = generateYellowscribe(ysSample, 'yellowscribe', { ...baseState, excludedAbilities });
    // Other units are untouched
    expect(out.units['ldr1'].abilities).toHaveProperty('Resurrection Orb');
  });

  it('adds forward ability to bodyguard abilities object with source annotation', () => {
    const attachments = new Map([['ldr1', {
      leaderId: 'ldr1', groupUuid: 'grp1',
      abilitiesForward: ['Resurrection Orb'], abilitiesReverse: [],
    }]]);
    const out = generateYellowscribe(ysSample, 'yellowscribe', { ...baseState, attachments });
    expect(out.units['grp1'].abilities).toHaveProperty('Resurrection Orb (from Lokhust Lord)');
    expect(out.units['grp1'].abilities).not.toHaveProperty('Resurrection Orb');
  });

  it('adds forward ability to bodyguard model list with source annotation', () => {
    const attachments = new Map([['ldr1', {
      leaderId: 'ldr1', groupUuid: 'grp1',
      abilitiesForward: ['Resurrection Orb'], abilitiesReverse: [],
    }]]);
    const out = generateYellowscribe(ysSample, 'yellowscribe', { ...baseState, attachments });
    const modelAbils = Object.values(out.units['grp1'].models.models)[0].abilities;
    expect(modelAbils).toContain('Resurrection Orb (from Lokhust Lord)');
    expect(modelAbils).not.toContain('Resurrection Orb');
  });

  it('adds reverse ability to leader abilities object with source annotation', () => {
    const attachments = new Map([['ldr1', {
      leaderId: 'ldr1', groupUuid: 'grp1',
      abilitiesForward: [], abilitiesReverse: ['Optimised For Slaughter'],
    }]]);
    const out = generateYellowscribe(ysSample, 'yellowscribe', { ...baseState, attachments });
    expect(out.units['ldr1'].abilities).toHaveProperty('Optimised For Slaughter (from Lokhust Heavy Destroyers)');
    expect(out.units['ldr1'].abilities).not.toHaveProperty('Optimised For Slaughter');
  });

  it('adds reverse ability to leader model list with source annotation', () => {
    const attachments = new Map([['ldr1', {
      leaderId: 'ldr1', groupUuid: 'grp1',
      abilitiesForward: [], abilitiesReverse: ['Optimised For Slaughter'],
    }]]);
    const out = generateYellowscribe(ysSample, 'yellowscribe', { ...baseState, attachments });
    const modelAbils = Object.values(out.units['ldr1'].models.models)[0].abilities;
    expect(modelAbils).toContain('Optimised For Slaughter (from Lokhust Heavy Destroyers)');
    expect(modelAbils).not.toContain('Optimised For Slaughter');
  });

  it('does not add forward ability that is excluded on the leader', () => {
    const attachments = new Map([['ldr1', {
      leaderId: 'ldr1', groupUuid: 'grp1',
      abilitiesForward: ['Resurrection Orb'], abilitiesReverse: [],
    }]]);
    const excludedAbilities = new Map([['ldr1', new Set(['Resurrection Orb'])]]);
    const out = generateYellowscribe(ysSample, 'yellowscribe', { ...baseState, attachments, excludedAbilities });
    const keys = Object.keys(out.units['grp1'].abilities);
    expect(keys.some(k => k.startsWith('Resurrection Orb'))).toBe(false);
  });

  it('does not add reverse ability that is excluded on the group', () => {
    const attachments = new Map([['ldr1', {
      leaderId: 'ldr1', groupUuid: 'grp1',
      abilitiesForward: [], abilitiesReverse: ['Optimised For Slaughter'],
    }]]);
    const excludedAbilities = new Map([['grp1', new Set(['Optimised For Slaughter'])]]);
    const out = generateYellowscribe(ysSample, 'yellowscribe', { ...baseState, attachments, excludedAbilities });
    const modelAbils = Object.values(out.units['ldr1'].models.models)[0].abilities;
    expect(modelAbils.some(a => a.startsWith('Optimised For Slaughter'))).toBe(false);
  });
});

// ── TTS input ─────────────────────────────────────────────────────────────

describe('generateYellowscribe (TTS input)', () => {
  const { leaders, groups, characters } = parseTTS(ttsSample);
  const baseState = {
    leaders, groups, characters,
    attachments:       new Map(),
    excludedAbilities: new Map(),
  };

  it('returns valid Yellowscribe structure', () => {
    const out = generateYellowscribe(ttsSample, 'tts', baseState);
    expect(out).toHaveProperty('edition', '10e');
    expect(Array.isArray(out.order)).toBe(true);
    expect(typeof out.units).toBe('object');
  });

  it('includes all leaders, groups, and characters', () => {
    const out = generateYellowscribe(ttsSample, 'tts', baseState);
    leaders.forEach(l    => expect(out.order).toContain(l.id));
    groups.forEach(g     => expect(out.order).toContain(g.uuid));
    characters.forEach(c => expect(out.order).toContain(String(c.objIdx)));
  });

  it('each unit has required Yellowscribe fields', () => {
    const out = generateYellowscribe(ttsSample, 'tts', baseState);
    Object.values(out.units).forEach(unit => {
      expect(unit).toHaveProperty('name');
      expect(unit).toHaveProperty('uuid');
      expect(unit).toHaveProperty('models');
      expect(unit).toHaveProperty('abilities');
      expect(unit).toHaveProperty('modelProfiles');
      expect(unit).toHaveProperty('weapons');
      expect(typeof unit.isSingleModel).toBe('boolean');
    });
  });

  it('leader units are marked isSingleModel', () => {
    const out = generateYellowscribe(ttsSample, 'tts', baseState);
    leaders.forEach(l => expect(out.units[l.id].isSingleModel).toBe(true));
  });

  it('leader role appears in model ability list', () => {
    const out = generateYellowscribe(ttsSample, 'tts', baseState);
    leaders.forEach(leader => {
      const modelAbils = Object.values(out.units[leader.id].models.models)[0].abilities;
      expect(modelAbils).toContain(leader.role);
    });
  });

  it('excluded ability is absent from unit abilities and model list', () => {
    const leader = leaders[0];
    const abilityName = leader.abilities[0]?.name;
    if (!abilityName) return;

    const excludedAbilities = new Map([[leader.id, new Set([abilityName])]]);
    const out = generateYellowscribe(ttsSample, 'tts', { ...baseState, excludedAbilities });
    const unit = out.units[leader.id];
    expect(unit.abilities).not.toHaveProperty(abilityName);
    const modelAbils = Object.values(unit.models.models)[0].abilities;
    expect(modelAbils).not.toContain(abilityName);
  });

  it('forward ability appears in bodyguard with source annotation after attachment', () => {
    const leader = leaders.find(l => l.role === 'Leader');
    const group  = groups[0];
    const abilityName = leader?.abilities[0]?.name;
    if (!leader || !abilityName) return;

    const attachments = new Map([[leader.id, {
      leaderId: leader.id, groupUuid: group.uuid,
      abilitiesForward: [abilityName], abilitiesReverse: [],
    }]]);
    const out = generateYellowscribe(ttsSample, 'tts', { ...baseState, attachments });
    const bodyguard = out.units[group.uuid];
    const annotated = `${abilityName} (from ${leader.name})`;
    expect(bodyguard.abilities).toHaveProperty(annotated);
    expect(bodyguard.abilities).not.toHaveProperty(abilityName);
    const modelAbils = Object.values(bodyguard.models.models)[0].abilities;
    expect(modelAbils).toContain(annotated);
  });

  it('does not mutate raw data', () => {
    const before = JSON.stringify(ttsSample);
    generateYellowscribe(ttsSample, 'tts', baseState);
    expect(JSON.stringify(ttsSample)).toBe(before);
  });
});
