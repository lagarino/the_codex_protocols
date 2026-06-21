import { describe, it, expect } from 'vitest';
import {
  removeAbilityFromDescription,
  removeAbilityFromLua,
  appendAbilitiesToDescription,
  injectAbilitiesIntoLua,
  generateOutput,
} from '../../src/engine/output.js';
import { parseTTS } from '../../src/parser/tts.js';
import ttsSample from '../fixtures/tts_sample.json';

// ── removeAbilityFromDescription ─────────────────────────────────────────

describe('removeAbilityFromDescription', () => {
  it('removes a matching ability line', () => {
    const desc = '[dc61ed]Abilities[-]\r\nLeader\r\nNanoscarab Amulet\r\n';
    const result = removeAbilityFromDescription(desc, 'Leader');
    expect(result).not.toContain('Leader');
    expect(result).toContain('Nanoscarab Amulet');
  });

  it('does not remove partial matches', () => {
    const desc = '[dc61ed]Abilities[-]\r\nLeader\r\nLeader Unit\r\n';
    const result = removeAbilityFromDescription(desc, 'Leader');
    expect(result).not.toContain('\r\nLeader\r\n');
    expect(result).toContain('Leader Unit');
  });

  it('handles missing ability gracefully', () => {
    const desc = '[dc61ed]Abilities[-]\r\nNanoscarab Amulet\r\n';
    const result = removeAbilityFromDescription(desc, 'Leader');
    expect(result).toBe(desc);
  });

  it('handles empty description', () => {
    expect(removeAbilityFromDescription('', 'Leader')).toBe('');
    expect(removeAbilityFromDescription(null, 'Leader')).toBe('');
  });
});

// ── appendAbilitiesToDescription ─────────────────────────────────────────

describe('appendAbilitiesToDescription', () => {
  it('appends abilities with attribution header', () => {
    const desc = '[dc61ed]Abilities[-]\r\nOwn Ability\r\n';
    const result = appendAbilitiesToDescription(desc, ['Borrowed Ability'], 'Lokhust Lord');
    expect(result).toContain('[ff9900]From Lokhust Lord:[-]');
    expect(result).toContain('Borrowed Ability');
    expect(result).toContain('Own Ability');
  });

  it('returns unchanged description for empty ability list', () => {
    const desc = 'some description';
    expect(appendAbilitiesToDescription(desc, [], 'Leader')).toBe(desc);
  });

  it('appends multiple abilities', () => {
    const desc = '[dc61ed]Abilities[-]\r\nA\r\n';
    const result = appendAbilitiesToDescription(desc, ['X', 'Y', 'Z'], 'Source');
    expect(result).toContain('X\r\nY\r\nZ');
  });
});

// ── removeAbilityFromLua ─────────────────────────────────────────────────

describe('removeAbilityFromLua', () => {
  const leaderLua = `abilities = {{ name = [[Leader]], desc = [=[Leader desc]=] }, { name = [[Nanoscarab Amulet]], desc = [=[FNP 5+.]=] }},\r\n                models = {{`;

  it('removes first entry (Leader)', () => {
    const result = removeAbilityFromLua(leaderLua, 'Leader');
    expect(result).not.toContain('name = [[Leader]]');
    expect(result).toContain('name = [[Nanoscarab Amulet]]');
  });

  it('removes non-first entry', () => {
    const result = removeAbilityFromLua(leaderLua, 'Nanoscarab Amulet');
    expect(result).not.toContain('Nanoscarab Amulet');
    expect(result).toContain('name = [[Leader]]');
  });

  it('handles regex special chars in ability names', () => {
    const lua = `abilities = {{ name = [[Feel No Pain 5+]], desc = [=[desc]=] }},\r\n                models = {{`;
    const result = removeAbilityFromLua(lua, 'Feel No Pain 5+');
    expect(result).not.toContain('Feel No Pain 5+');
  });

  it('returns unchanged lua when ability not found', () => {
    const result = removeAbilityFromLua(leaderLua, 'Nonexistent');
    expect(result).toBe(leaderLua);
  });
});

// ── generateOutput ────────────────────────────────────────────────────────

describe('generateOutput', () => {
  const { leaders, groups, characters } = parseTTS(ttsSample);

  it('does not mutate the original rawData', () => {
    const original = JSON.stringify(ttsSample);
    generateOutput(ttsSample, {
      leaders, groups, characters,
      attachments: new Map(),
      excludedAbilities: new Map(),
      fontScale: 20,
    });
    expect(JSON.stringify(ttsSample)).toBe(original);
  });

  it('strips Leader keyword from leader units', () => {
    const output = generateOutput(ttsSample, {
      leaders, groups, characters,
      attachments: new Map(),
      excludedAbilities: new Map(),
      fontScale: 20,
    });
    leaders.forEach(l => {
      const obj = output.ObjectStates[l.objIdx];
      expect(obj.Description).not.toMatch(/\r\nLeader\r\n/);
    });
  });

  it('strips excluded abilities from description', () => {
    const leader = leaders[0];
    const abilityToExclude = leader.abilities[0]?.name;
    if (!abilityToExclude) return;

    const excludedAbilities = new Map([[leader.id, new Set([abilityToExclude])]]);
    const output = generateOutput(ttsSample, {
      leaders, groups, characters,
      attachments: new Map(),
      excludedAbilities,
      fontScale: 20,
    });
    const obj = output.ObjectStates[leader.objIdx];
    const abLines = obj.Description.split('\r\n').map(l => l.trim());
    expect(abLines).not.toContain(abilityToExclude);
  });

  it('injects forward abilities into bodyguard', () => {
    const leader = leaders.find(l => l.role === 'Leader');
    const group  = groups[0];
    const abilityName = leader?.abilities[0]?.name;
    if (!leader || !abilityName) return;

    const attachments = new Map([[
      leader.id,
      { leaderId: leader.id, groupUuid: group.uuid, abilitiesForward: [abilityName], abilitiesReverse: [] }
    ]]);

    const output = generateOutput(ttsSample, {
      leaders, groups, characters, attachments,
      excludedAbilities: new Map(), fontScale: 20,
    });

    // Every model in the group should have the ability in their description
    group.indices.forEach(idx => {
      expect(output.ObjectStates[idx].Description).toContain(abilityName);
    });
  });

  it('does not inject excluded forward abilities', () => {
    const leader = leaders.find(l => l.role === 'Leader');
    const group  = groups[0];
    const abilityName = leader?.abilities[0]?.name;
    if (!leader || !abilityName) return;

    const attachments = new Map([[
      leader.id,
      { leaderId: leader.id, groupUuid: group.uuid, abilitiesForward: [abilityName], abilitiesReverse: [] }
    ]]);
    const excludedAbilities = new Map([[leader.id, new Set([abilityName])]]);

    const output = generateOutput(ttsSample, {
      leaders, groups, characters, attachments, excludedAbilities, fontScale: 20,
    });

    group.indices.forEach(idx => {
      // Should not be injected since it's excluded
      const desc = output.ObjectStates[idx].Description;
      const fromLine = `From ${leader.name}`;
      if (desc.includes(fromLine)) {
        // If there's a "From X" section, the excluded ability shouldn't be in it
        const fromIdx = desc.indexOf(fromLine);
        expect(desc.slice(fromIdx)).not.toContain(abilityName);
      }
    });
  });

  it('preserves ObjectStates length', () => {
    const output = generateOutput(ttsSample, {
      leaders, groups, characters,
      attachments: new Map(), excludedAbilities: new Map(), fontScale: 20,
    });
    expect(output.ObjectStates.length).toBe(ttsSample.ObjectStates.length);
  });
});
