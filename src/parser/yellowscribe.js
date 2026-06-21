/**
 * Yellowscribe army list parser.
 *
 * Reads the { edition, order, units } format and produces the same internal
 * { leaders, groups, characters } model as the TTS parser.
 */

// ── Full unit data (for print engine) ────────────────────────────────────

export function parseFullUnit(data, uuid) {
  const unit = data.units?.[uuid];
  if (!unit) return null;

  // Stats from modelProfiles
  const models = Object.values(unit.modelProfiles || {}).map(p => ({
    m: p.m, t: p.t, sv: p.sv, w: p.w, ld: p.ld, oc: p.oc, name: p.name,
  }));

  // Weapons in model order
  const firstModel = Object.values(unit.models?.models || {})[0];
  const weaponNames = firstModel
    ? firstModel.weapons.map(w => w.name)
    : Object.keys(unit.weapons || {});

  const weapons = weaponNames.map(n => {
    const w = unit.weapons?.[n];
    if (!w) return null;
    return {
      name: n, range: w.range, a: w.a, bsws: w.bsws,
      s:    w.s, ap:   w.ap,   d: w.d,
      abilities: (w.abilities && w.abilities !== '-') ? w.abilities : '',
    };
  }).filter(Boolean);

  // Invuln from ability names
  const invulnKey = Object.keys(unit.abilities || {})
    .find(n => n.startsWith('Invulnerable Save'));
  const invulnMatch = invulnKey?.match(/\((\d+\+)\)/);
  const invuln = invulnMatch ? invulnMatch[1] : (invulnKey ? '4+' : null);

  // Own abilities (excluding role keywords and invuln)
  const firstModelAbilities = firstModel?.abilities || [];
  const ownAbilities = firstModelAbilities
    .filter(n => n !== 'Leader' && n !== 'Support' && !n.startsWith('Invulnerable Save'))
    .map(n => ({ name: n, desc: unit.abilities?.[n]?.desc || '' }));

  return {
    name:     unit.name,
    faction:  (unit.factionKeywords || [])[0] || '',
    keywords: (unit.keywords || []).join(', '),
    models,
    weapons,
    invuln,
    ownAbilities,
    inhAbilities: [],
  };
}

// ── Top-level parse ───────────────────────────────────────────────────────

/**
 * Parse a Yellowscribe army list into the internal army model.
 * @param {object} data - Raw parsed JSON
 * @returns {{ leaders: Leader[], groups: Group[], characters: Character[] }}
 */
export function parseYellowscribe(data) {
  const leaders    = [];
  const groups     = [];
  const characters = [];

  const order = data.order || Object.keys(data.units);

  order.forEach((uuid, i) => {
    const unit = data.units[uuid];
    if (!unit) return;

    const keywords = unit.keywords || [];
    const isChar   = keywords.includes('Character');

    // Collect all ability names across all model types
    const allModelAbilityNames = new Set();
    Object.values(unit.models?.models || {}).forEach(m => {
      (m.abilities || []).forEach(a => allModelAbilityNames.add(a));
    });

    const hasLeader  = allModelAbilityNames.has('Leader');
    const hasSupport = allModelAbilityNames.has('Support');
    const role = hasLeader ? 'Leader' : hasSupport ? 'Support' : null;

    const abilities = [...allModelAbilityNames]
      .filter(n => n !== 'Leader' && n !== 'Support' && !n.startsWith('Invulnerable Save'))
      .map(n => ({ name: n, desc: unit.abilities?.[n]?.desc || '' }));

    if (role && isChar) {
      leaders.push({ id: uuid, name: unit.name, role, abilities, keywords, objIdx: uuid });
    } else if (isChar) {
      characters.push({ objIdx: uuid, name: unit.name });
    } else {
      groups.push({
        uuid,
        name:      unit.name,
        models:    unit.models?.totalNumberOfModels || 1,
        indices:   [uuid],
        abilities,
      });
    }
  });

  return { leaders, groups, characters };
}
