/**
 * TTS export engine.
 *
 * Takes the army state and produces a modified TTS JSON object ready for
 * download. All transforms operate on a deep clone of the raw data so the
 * original is never mutated.
 */

import { extractAbilityDescriptions } from '../parser/utils.js';

// ── Description transforms ────────────────────────────────────────────────

export function removeAbilityFromDescription(description, ability) {
  return (description || '').split('\r\n')
    .filter(line => line.trim() !== ability)
    .join('\r\n');
}

export function appendAbilitiesToDescription(description, abilityNames, sourceName) {
  if (!abilityNames.length) return description;
  const header = `\r\n[ff9900]From ${sourceName}:[-]`;
  const body   = abilityNames.join('\r\n');
  return (description || '').replace(/\r\n$/, '') + header + '\r\n' + body + '\r\n';
}

// ── LuaScript transforms ──────────────────────────────────────────────────

export function removeAbilityFromLua(lua, ability) {
  const esc = ability.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Non-first entry: ', { name = [[Ability]], desc = [=[...]=] }'
  let result = lua.replace(
    new RegExp(`,\\s*\\{\\s*name\\s*=\\s*\\[\\[${esc}\\]\\]\\s*,\\s*desc\\s*=\\s*\\[=\\[[\\s\\S]*?\\]=\\]\\s*\\}`, 'g'),
    ''
  );
  if (result !== lua) return result;
  // First entry: '{ name = [[Ability]], desc = [=[...]=] }'
  return lua.replace(
    new RegExp(`\\{\\s*name\\s*=\\s*\\[\\[${esc}\\]\\]\\s*,\\s*desc\\s*=\\s*\\[=\\[[\\s\\S]*?\\]=\\]\\s*\\}\\s*,?\\s*`, 'g'),
    ''
  );
}

export function injectAbilitiesIntoLua(lua, abilities, sourceName) {
  if (!abilities.length) return lua;
  const end = lua.match(/(]=\])\s*(}}),([ \t]*\r?\n[ \t]*models\b)/);
  if (!end) return lua;
  const newEntries = abilities.map(
    ({ name, desc }) => `, { name = [[${name} (from ${sourceName})]], desc = [=[${desc}]=] }`
  ).join('');
  const insertAt = lua.lastIndexOf(']=] }},', lua.indexOf(end[0]) + end[0].length);
  return lua.slice(0, insertAt + ']=]'.length)
    + ' }' + newEntries + '},'
    + lua.slice(insertAt + ']=] }},'.length);
}

export function resizeFontInLua(lua, fontSize) {
  const scale = fontSize / 20;
  const start = lua.indexOf('uiTemplates = {');
  if (start === -1) return lua;
  const end = lua.indexOf('\n--[[ SCRIPTING', start);
  const boundary = end === -1 ? lua.length : end;
  let template = lua.slice(start, boundary);
  template = template.replace(/(<Row\b[^>]*\bpreferredHeight=")(\d+)(")/g,
    (_, a, n, c) => a + Math.max(20, Math.round(parseInt(n) * scale)) + c);
  template = template.replace(/(resizeTextMaxSize=")(\d+)(")/g,
    (_, a, n, c) => a + Math.max(6, Math.round(parseInt(n) * scale)) + c);
  template = template.replace(/(fontSize=")(\d+)(")/g,
    (_, a, n, c) => a + Math.max(6, Math.round(parseInt(n) * scale)) + c);
  return lua.slice(0, start) + template + lua.slice(boundary);
}

// ── Main export transform ─────────────────────────────────────────────────

/**
 * Produce a modified TTS JSON object from the current army state.
 *
 * @param {object}  rawData           - Original parsed TTS JSON (not mutated)
 * @param {object}  armyState         - { leaders, groups, characters, attachments, excludedAbilities, fontScale }
 * @returns {object} Modified TTS JSON ready for download
 */
export function generateOutput(rawData, armyState) {
  const data    = JSON.parse(JSON.stringify(rawData)); // deep clone
  const objects = data.ObjectStates;
  const { leaders, groups, characters, attachments, excludedAbilities, fontScale } = armyState;

  // ── 1. Strip excluded native abilities ───────────────────
  const stripExcluded = (objIdx, unitId) => {
    const excluded = excludedAbilities.get(String(unitId));
    if (!excluded || excluded.size === 0) return;
    const obj = objects[objIdx];
    if (!obj) return;
    excluded.forEach(name => {
      obj.Description = removeAbilityFromDescription(obj.Description || '', name);
      obj.LuaScript   = removeAbilityFromLua(obj.LuaScript || '', name);
    });
  };

  leaders.forEach(l    => stripExcluded(l.objIdx, l.id));
  groups.forEach(g     => g.indices.forEach(idx => stripExcluded(idx, g.uuid)));
  characters.forEach(c => stripExcluded(c.objIdx, String(c.objIdx)));

  // ── 2. Font scaling ───────────────────────────────────────
  if (fontScale !== 20) {
    objects.forEach(obj => {
      if (obj.LuaScript?.includes('uiTemplates')) {
        obj.LuaScript = resizeFontInLua(obj.LuaScript, fontScale);
      }
    });
  }

  // ── 3. Attachment transforms ──────────────────────────────
  leaders.forEach(leader => {
    const obj = objects[leader.objIdx];
    obj.Description = removeAbilityFromDescription(obj.Description, leader.role);
    obj.LuaScript   = removeAbilityFromLua(obj.LuaScript || '', leader.role);

    const att = attachments.get(leader.id);
    if (!att) return;

    const group = groups.find(g => g.uuid === att.groupUuid);
    if (!group) return;

    const leaderExcluded = excludedAbilities.get(String(leader.id)) || new Set();
    const groupExcluded  = excludedAbilities.get(String(group.uuid)) || new Set();

    const leaderLua     = rawData.ObjectStates[leader.objIdx].LuaScript || '';
    const groupLua      = rawData.ObjectStates[group.indices[0]].LuaScript || '';
    const leaderDescMap = extractAbilityDescriptions(leaderLua);
    const groupDescMap  = extractAbilityDescriptions(groupLua);

    const fwdAbilities = att.abilitiesForward
      .filter(n => !leaderExcluded.has(n) && !groupExcluded.has(n))
      .map(n => ({ name: n, desc: leaderDescMap[n] || '' }));

    const revAbilities = att.abilitiesReverse
      .filter(n => !groupExcluded.has(n) && !leaderExcluded.has(n))
      .map(n => ({ name: n, desc: groupDescMap[n] || '' }));

    const groupDisplayName = group.name.split(' (')[0];

    group.indices.forEach(idx => {
      if (fwdAbilities.length) {
        objects[idx].Description = appendAbilitiesToDescription(
          objects[idx].Description, fwdAbilities.map(a => a.name), leader.name);
        objects[idx].LuaScript = injectAbilitiesIntoLua(
          objects[idx].LuaScript || '', fwdAbilities, leader.name);
      }
    });

    if (revAbilities.length) {
      obj.Description = appendAbilitiesToDescription(
        obj.Description, revAbilities.map(a => a.name), groupDisplayName);
      obj.LuaScript = injectAbilitiesIntoLua(
        obj.LuaScript || '', revAbilities, groupDisplayName);
    }
  });

  return data;
}
