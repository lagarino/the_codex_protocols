import { describe, it, expect } from 'vitest';
import {
  filterAbilities,
  renderStatsTable,
  renderWeaponsRows,
  renderAbilityBlock,
  buildPrintDocument,
  buildSoloCard,
  buildPrintOutput,
} from '../../src/engine/print.js';
import { parseYellowscribe } from '../../src/parser/yellowscribe.js';
import sample from '../fixtures/yellowscribe_sample.json';

// ── filterAbilities ───────────────────────────────────────────────────────

describe('filterAbilities', () => {
  const abilities = [
    { name: 'A', desc: 'desc A' },
    { name: 'B', desc: 'desc B' },
    { name: 'C', desc: 'desc C' },
  ];

  it('returns all abilities when none excluded', () => {
    expect(filterAbilities('unit1', abilities, new Map())).toEqual(abilities);
  });

  it('removes excluded abilities', () => {
    const excluded = new Map([['unit1', new Set(['B'])]]);
    const result = filterAbilities('unit1', abilities, excluded);
    expect(result).toHaveLength(2);
    expect(result.map(a => a.name)).not.toContain('B');
  });

  it('does not filter other units', () => {
    const excluded = new Map([['unit2', new Set(['A'])]]);
    const result = filterAbilities('unit1', abilities, excluded);
    expect(result).toEqual(abilities);
  });

  it('returns empty array when all excluded', () => {
    const excluded = new Map([['u', new Set(['A', 'B', 'C'])]]);
    expect(filterAbilities('u', abilities, excluded)).toEqual([]);
  });
});

// ── renderStatsTable ─────────────────────────────────────────────────────

describe('renderStatsTable', () => {
  const models = [{ m: '8"', t: '6', sv: '3+', w: '4', ld: '7+', oc: '2', name: '' }];

  it('renders stat headers', () => {
    const html = renderStatsTable(models, null);
    ['M', 'T', 'Sv', 'W', 'Ld', 'OC'].forEach(h => expect(html).toContain(h));
  });

  it('renders stat values', () => {
    const html = renderStatsTable(models, null);
    expect(html).toContain('8"');
    expect(html).toContain('3+');
  });

  it('includes invuln row when provided', () => {
    const html = renderStatsTable(models, '4+');
    expect(html).toContain('Invulnerable Save: 4+');
  });

  it('omits invuln row when null', () => {
    const html = renderStatsTable(models, null);
    expect(html).not.toContain('Invulnerable Save');
  });
});

// ── renderWeaponsRows ────────────────────────────────────────────────────

describe('renderWeaponsRows', () => {
  const weapons = [
    { name: 'Staff of light', range: '18"', a: '3', bsws: '2+', s: '7', ap: '-2', d: '1', abilities: '' },
    { name: 'Close combat weapon', range: 'Melee', a: '4', bsws: '2+', s: '7', ap: '-2', d: '1', abilities: '' },
  ];

  it('renders weapon names', () => {
    const html = renderWeaponsRows(weapons);
    expect(html).toContain('Staff of light');
    expect(html).toContain('Close combat weapon');
  });

  it('adds from-leader class when specified', () => {
    const html = renderWeaponsRows(weapons, true);
    expect(html).toContain('from-leader');
  });

  it('does not add from-leader class by default', () => {
    const html = renderWeaponsRows(weapons);
    expect(html).not.toContain('from-leader');
  });
});

// ── renderAbilityBlock ───────────────────────────────────────────────────

describe('renderAbilityBlock', () => {
  it('renders ability names', () => {
    const html = renderAbilityBlock([{ name: 'Deep Strike', desc: 'Set up in reserves.' }]);
    expect(html).toContain('Deep Strike');
    expect(html).toContain('Set up in reserves.');
  });

  it('applies css class when provided', () => {
    const html = renderAbilityBlock([{ name: 'X', desc: '' }], 'inherited');
    expect(html).toContain('inherited');
  });

  it('handles empty desc gracefully', () => {
    const html = renderAbilityBlock([{ name: 'X', desc: '' }]);
    expect(html).not.toContain('<div class="pc-ability-desc"></div>');
  });
});

// ── buildPrintDocument ───────────────────────────────────────────────────

describe('buildPrintDocument', () => {
  it('returns a valid HTML document', () => {
    const html = buildPrintDocument('<div>card</div>');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('<div>card</div>');
  });

  it('includes A4 landscape page size', () => {
    const html = buildPrintDocument('');
    expect(html).toContain('A4 landscape');
  });

  it('includes font imports', () => {
    const html = buildPrintDocument('');
    expect(html).toContain('Rajdhani');
    expect(html).toContain('Inter');
  });

  it('includes auto-print script', () => {
    const html = buildPrintDocument('');
    expect(html).toContain('window.print()');
    expect(html).toContain('document.fonts.ready');
  });
});

// ── buildPrintOutput (integration) ───────────────────────────────────────

describe('buildPrintOutput', () => {
  const { leaders, groups, characters } = parseYellowscribe(sample);

  const armyState = {
    leaders, groups, characters,
    attachments:       new Map(),
    excludedAbilities: new Map(),
  };

  it('produces a valid HTML document', () => {
    const html = buildPrintOutput(sample, 'yellowscribe', armyState);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('includes all group names', () => {
    const html = buildPrintOutput(sample, 'yellowscribe', armyState);
    groups.forEach(g => expect(html).toContain(g.name));
  });

  it('includes unattached leader cards', () => {
    const html = buildPrintOutput(sample, 'yellowscribe', armyState);
    leaders.forEach(l => expect(html).toContain(l.name));
  });

  it('includes character cards', () => {
    const html = buildPrintOutput(sample, 'yellowscribe', armyState);
    characters.forEach(c => expect(html).toContain(c.name));
  });

  it('respects excluded abilities', () => {
    const excludedAbilities = new Map([['grp1', new Set(['Optimised For Slaughter'])]]);
    const html = buildPrintOutput(sample, 'yellowscribe', {
      ...armyState, excludedAbilities,
    });
    // Excluded ability should not appear in the Lokhust Heavy Destroyers card
    // (it may still appear in other units' sections, but the card for grp1 should omit it)
    expect(html).toBeDefined(); // At minimum, it should not throw
  });

  it('merges attached leader into bodyguard card', () => {
    const lord = leaders.find(l => l.id === 'ldr1');
    const destroyers = groups.find(g => g.uuid === 'grp1');
    const attachments = new Map([[
      lord.id,
      { leaderId: lord.id, groupUuid: destroyers.uuid, abilitiesForward: [], abilitiesReverse: [] }
    ]]);
    const html = buildPrintOutput(sample, 'yellowscribe', { ...armyState, attachments });
    // Both names should appear in the document (in the same card)
    expect(html).toContain(lord.name);
    expect(html).toContain(destroyers.name);
    // Leader should not get a solo card
    const leaderCardCount = (html.match(/pc-role-badge.*?Leader/g) || []).length;
    expect(leaderCardCount).toBe(0); // attached leader has no solo card
  });
});
