/**
 * TTS (Tabletop Simulator) save file parser.
 *
 * Reads ObjectStates and produces the internal { leaders, groups, characters }
 * model consumed by the rest of the app.
 */

import {
  cleanName,
  getUuidTag,
  extractKeywords,
  extractAbilityDescriptions,
  parseAbilitiesFromDescription,
  ABILITIES_HEADER,
} from './utils.js';

// ── Role detection ────────────────────────────────────────────────────────

export function hasLeaderOrSupport(description) {
  const abilities = parseAbilitiesFromDescription(description);
  if (abilities.includes('Leader'))  return 'Leader';
  if (abilities.includes('Support')) return 'Support';
  return null;
}

// ── Stats / weapons parsing (for print engine) ────────────────────────────

export function parseModels(lua) {
  const out = [];
  // Movement can contain escaped quote: "8\"" — use (?:[^"\\]|\\.)*
  const re = /\{\s*m\s*=\s*"((?:[^"\\]|\\.)*)"\s*,\s*t\s*=\s*"([^"]+)"\s*,\s*sv\s*=\s*"([^"]+)"\s*,\s*w\s*=\s*"([^"]+)"\s*,\s*ld\s*=\s*"([^"]+)"\s*,\s*oc\s*=\s*"([^"]+)"(?:\s*,\s*name\s*=\s*"([^"]*)")?\s*\}/g;
  let m;
  while ((m = re.exec(lua)) !== null) {
    out.push({
      m:    m[1].replace(/\\"/g, '"'),
      t:    m[2], sv: m[3], w: m[4], ld: m[5], oc: m[6],
      name: m[7] || '',
    });
  }
  return out;
}

export function parseWeapons(lua) {
  const out = [];
  const re = /\{\s*name\s*=\s*"([^"]+)"\s*,\s*range\s*=\s*\[\[([^\]]*)\]\]\s*,\s*a\s*=\s*"([^"]+)"\s*,\s*bsws\s*=\s*"([^"]+)"\s*,\s*s\s*=\s*"([^"]+)"\s*,\s*ap\s*=\s*"([^"]+)"\s*,\s*d\s*=\s*"([^"]+)"\s*,\s*abilities\s*=\s*\[\[([^\]]*)\]\]\s*\}/g;
  let m;
  while ((m = re.exec(lua)) !== null) {
    out.push({
      name: m[1], range: m[2], a: m[3], bsws: m[4],
      s:    m[5], ap:    m[6], d: m[7],
      abilities: m[8].trim(),
    });
  }
  return out;
}

export function parseInvuln(description) {
  const m = description.match(/Invulnerable Save:\[-\]\s*(\d+\+)/);
  return m ? m[1] : null;
}

// ── Full unit data (for print engine) ────────────────────────────────────

export function parseFullUnit(rawData, id) {
  const obj = rawData.ObjectStates[id];
  if (!obj) return null;

  const lua  = obj.LuaScript  || '';
  const desc = obj.Description || '';
  const abilityDescMap = extractAbilityDescriptions(lua);
  const rawAbilities   = parseAbilitiesFromDescription(desc);

  const ownAbilities = [];
  const inhAbilities = [];
  let inInherited    = false;
  let inheritedSource = '';

  for (const line of rawAbilities) {
    if (line.startsWith('[ff9900]')) {
      inInherited     = true;
      inheritedSource = line.replace(/\[ff9900\]From ([^\[]+):\[-\]/, '$1').trim();
      continue;
    }
    if (inInherited) {
      inhAbilities.push({ name: line, desc: abilityDescMap[line] || '', source: inheritedSource });
    } else if (line !== 'Leader' && line !== 'Support') {
      ownAbilities.push({ name: line, desc: abilityDescMap[line] || '' });
    }
  }

  return {
    name:     (lua.match(/unitDecorativeName\s*=\s*"([^"]+)"/) || [])[1] || cleanName(obj.Nickname),
    faction:  (lua.match(/factionKeywords\s*=\s*"([^"]+)"/)    || [])[1] || '',
    keywords: (lua.match(/\bkeywords\s*=\s*"([^"]+)"/)         || [])[1] || '',
    models:   parseModels(lua),
    weapons:  parseWeapons(lua),
    invuln:   parseInvuln(desc),
    ownAbilities,
    inhAbilities,
  };
}

// ── Top-level parse ───────────────────────────────────────────────────────

/**
 * Parse a TTS save file into the internal army model.
 * @param {object} data - Raw parsed JSON
 * @returns {{ leaders: Leader[], groups: Group[], characters: Character[] }}
 */
export function parseTTS(data) {
  const objects = data.ObjectStates || [];
  const leaders    = [];
  const characters = [];
  const leaderIndices = new Set();

  objects.forEach((obj, i) => {
    const nick = obj.Nickname || '';
    if (!nick.trim()) return;

    const role = hasLeaderOrSupport(obj.Description || '');
    if (role) {
      const lua = obj.LuaScript || '';
      const descMap = extractAbilityDescriptions(lua);
      const rawAbilities = parseAbilitiesFromDescription(obj.Description);
      const abilities = rawAbilities
        .filter(a => a !== 'Leader' && a !== 'Support')
        .map(name => ({ name, desc: descMap[name] || '' }));

      leaders.push({
        id:       String(i),
        name:     cleanName(nick),
        role,
        abilities,
        keywords: [...extractKeywords(lua)],
        objIdx:   i,
      });
      leaderIndices.add(i);
      return;
    }

    if (extractKeywords(obj.LuaScript || '').has('Character')) {
      characters.push({ objIdx: i, name: cleanName(nick) });
      leaderIndices.add(i);
    }
  });

  // Group regular units by uuid tag
  const uuidMap = new Map();
  objects.forEach((obj, i) => {
    if (leaderIndices.has(i)) return;
    const nick = obj.Nickname || '';
    if (!nick.trim()) return;

    const uuid = getUuidTag(obj) || `__solo_${i}__`;
    if (!uuidMap.has(uuid)) {
      uuidMap.set(uuid, { name: cleanName(nick), indices: [] });
    }
    uuidMap.get(uuid).indices.push(i);
  });

  const groups = [];
  uuidMap.forEach(({ name, indices }, uuid) => {
    const firstObj = objects[indices[0]];
    const lua = firstObj.LuaScript || '';
    const descMap = extractAbilityDescriptions(lua);
    const rawAbilities = parseAbilitiesFromDescription(firstObj.Description || '');
    const abilities = rawAbilities
      .filter(a => !a.startsWith('[ff9900]'))
      .map(name => ({ name, desc: descMap[name] || '' }));
    groups.push({ uuid, name, models: indices.length, indices, abilities });
  });

  return { leaders, groups, characters };
}
