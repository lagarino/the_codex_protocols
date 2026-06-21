/**
 * Yellowscribe export engine.
 *
 * Produces a Yellowscribe-format JSON from the current army state.
 * Works for both Yellowscribe (clone + patch) and TTS (convert from scratch) input.
 */

import { parseFullUnit as parseFullUnitTTS } from '../parser/tts.js';

// ── Yellowscribe → Yellowscribe ───────────────────────────────────────────

function generateFromYellowscribe(rawData, armyState) {
  const data = JSON.parse(JSON.stringify(rawData));
  const { leaders, groups, characters, attachments, excludedAbilities } = armyState;

  leaders.forEach(l =>
    applyExclusions(data.units[l.objIdx], excludedAbilities.get(String(l.id))));
  groups.forEach(g =>
    applyExclusions(data.units[g.uuid], excludedAbilities.get(String(g.uuid))));
  characters.forEach(c =>
    applyExclusions(data.units[c.objIdx], excludedAbilities.get(String(c.objIdx))));

  attachments.forEach((att, leaderId) => {
    const leader = leaders.find(l => l.id === leaderId);
    const group  = groups.find(g => g.uuid === att.groupUuid);
    if (!leader || !group) return;

    const leaderExcluded = excludedAbilities.get(String(leaderId))  || new Set();
    const groupExcluded  = excludedAbilities.get(String(group.uuid)) || new Set();
    const leaderUnit     = data.units[leader.objIdx];
    const bodyguardUnit  = data.units[group.uuid];

    att.abilitiesForward
      .filter(n => !leaderExcluded.has(n) && !groupExcluded.has(n))
      .forEach(name => {
        const ab = leaderUnit?.abilities?.[name];
        if (!ab) return;
        injectSharedAbility(bodyguardUnit, ab, leaderUnit.name);
      });

    att.abilitiesReverse
      .filter(n => !groupExcluded.has(n) && !leaderExcluded.has(n))
      .forEach(name => {
        const ab = bodyguardUnit?.abilities?.[name];
        if (!ab) return;
        injectSharedAbility(leaderUnit, ab, bodyguardUnit.name);
      });
  });

  return data;
}

function injectSharedAbility(targetUnit, sourceAbility, sourceName) {
  const annotatedName = `${sourceAbility.name} (from ${sourceName})`;
  targetUnit.abilities[annotatedName] = { name: annotatedName, desc: sourceAbility.desc };
  Object.values(targetUnit.models.models).forEach(m => {
    if (!m.abilities.includes(annotatedName)) m.abilities.push(annotatedName);
  });
}

function applyExclusions(unit, excluded) {
  if (!unit || !excluded || excluded.size === 0) return;
  excluded.forEach(name => {
    delete unit.abilities[name];
    Object.values(unit.models?.models || {}).forEach(m => {
      m.abilities = m.abilities.filter(a => a !== name);
    });
  });
}

// ── TTS → Yellowscribe ────────────────────────────────────────────────────

function generateFromTTS(rawData, armyState) {
  const { leaders, groups, characters, attachments, excludedAbilities } = armyState;

  const entries = [];

  leaders.forEach(leader => {
    const full = parseFullUnitTTS(rawData, leader.objIdx);
    if (!full) return;
    const excluded = excludedAbilities.get(String(leader.id)) || new Set();
    entries.push({
      sortKey: leader.objIdx,
      id:      leader.id,
      unit:    buildYSUnit(full, leader.id, leader.role, 1, excluded),
    });
  });

  characters.forEach(char => {
    const full = parseFullUnitTTS(rawData, char.objIdx);
    if (!full) return;
    const excluded = excludedAbilities.get(String(char.objIdx)) || new Set();
    entries.push({
      sortKey: char.objIdx,
      id:      String(char.objIdx),
      unit:    buildYSUnit(full, String(char.objIdx), null, 1, excluded),
    });
  });

  groups.forEach(group => {
    const full = parseFullUnitTTS(rawData, group.indices[0]);
    if (!full) return;
    const excluded = excludedAbilities.get(String(group.uuid)) || new Set();
    entries.push({
      sortKey: group.indices[0],
      id:      group.uuid,
      unit:    buildYSUnit(full, group.uuid, null, group.models, excluded),
    });
  });

  entries.sort((a, b) => a.sortKey - b.sortKey);

  const order = entries.map(e => e.id);
  const units = Object.fromEntries(entries.map(e => [e.id, e.unit]));

  attachments.forEach((att, leaderId) => {
    const leader = leaders.find(l => l.id === leaderId);
    const group  = groups.find(g => g.uuid === att.groupUuid);
    if (!leader || !group) return;

    const leaderUnit    = units[leader.id];
    const bodyguardUnit = units[group.uuid];
    if (!leaderUnit || !bodyguardUnit) return;

    const leaderExcluded = excludedAbilities.get(String(leaderId))  || new Set();
    const groupExcluded  = excludedAbilities.get(String(group.uuid)) || new Set();

    att.abilitiesForward
      .filter(n => !leaderExcluded.has(n) && !groupExcluded.has(n))
      .forEach(name => {
        const ab = leaderUnit.abilities[name];
        if (!ab) return;
        injectSharedAbility(bodyguardUnit, ab, leaderUnit.name);
      });

    att.abilitiesReverse
      .filter(n => !groupExcluded.has(n) && !leaderExcluded.has(n))
      .forEach(name => {
        const ab = bodyguardUnit.abilities[name];
        if (!ab) return;
        injectSharedAbility(leaderUnit, ab, bodyguardUnit.name);
      });
  });

  return { edition: '10e', order, units };
}

function buildYSUnit(full, uuid, role, totalModels, excluded) {
  const abilities = {};
  if (role) abilities[role] = { name: role, desc: '' };
  full.ownAbilities.forEach(ab => {
    if (!excluded.has(ab.name)) abilities[ab.name] = { name: ab.name, desc: ab.desc };
  });
  if (full.invuln) {
    const key = `Invulnerable Save (${full.invuln})`;
    abilities[key] = { name: key, desc: '' };
  }

  const modelAbilities = [
    ...(role ? [role] : []),
    ...full.ownAbilities.filter(ab => !excluded.has(ab.name)).map(ab => ab.name),
    ...(full.invuln ? [`Invulnerable Save (${full.invuln})`] : []),
  ];

  const modelProfiles = {};
  full.models.forEach(row => {
    const key = row.name || full.name;
    modelProfiles[key] = { m: row.m, t: row.t, sv: row.sv, w: row.w, ld: row.ld, oc: row.oc, name: key };
  });

  const weapons = {};
  full.weapons.forEach(w => {
    weapons[w.name] = {
      range: w.range, a: w.a, bsws: w.bsws, s: w.s,
      ap: w.ap, d: w.d, abilities: w.abilities || '-', name: w.name,
    };
  });

  return {
    name:           full.name,
    factionKeywords: full.faction ? [full.faction] : [],
    keywords:       full.keywords ? full.keywords.split(', ').filter(Boolean) : [],
    isSingleModel:  totalModels === 1,
    uuid,
    models: {
      totalNumberOfModels: totalModels,
      models: {
        m1: {
          name:      full.models[0]?.name || full.name,
          number:    totalModels,
          abilities: modelAbilities,
          weapons:   full.weapons.map(w => ({ name: w.name, number: 1 })),
        },
      },
    },
    abilities,
    modelProfiles,
    weapons,
  };
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Generate a Yellowscribe-format JSON from the current army state.
 *
 * @param {object} rawData
 * @param {'tts'|'yellowscribe'} format
 * @param {object} armyState - { leaders, groups, characters, attachments, excludedAbilities }
 * @returns {object} Yellowscribe JSON
 */
export function generateYellowscribe(rawData, format, armyState) {
  return format === 'yellowscribe'
    ? generateFromYellowscribe(rawData, armyState)
    : generateFromTTS(rawData, armyState);
}
