const COLOUR_RE = /\[[0-9a-fA-F]{6}\]|\[-\]/g;

/** Strip TTS colour tags like [00ff16] and [-] */
export function stripColour(s) {
  return s.replace(COLOUR_RE, '');
}

/** Clean a TTS Nickname into a plain unit name */
export function cleanName(nick) {
  return stripColour(nick).trim().replace(/^\d+\/\d+\s+/, '');
}

/** Return the uuid:* tag value from a TTS object's Tags array, or null */
export function getUuidTag(obj) {
  const tags = obj.Tags || [];
  const t = tags.find(t => t.startsWith('uuid:'));
  return t || null;
}

/** Extract keywords set from LuaScript */
export function extractKeywords(lua) {
  const m = lua.match(/\bkeywords\s*=\s*"([^"]+)"/);
  if (!m) return new Set();
  return new Set(m[1].split(',').map(k => k.trim()));
}

/** Extract { abilityName -> desc } from LuaScript ability table entries */
export function extractAbilityDescriptions(lua) {
  const map = {};
  const re = /\{\s*name\s*=\s*\[\[(.+?)\]\]\s*,\s*desc\s*=\s*\[=\[([\s\S]+?)]=\]\s*\}/g;
  let m;
  while ((m = re.exec(lua)) !== null) {
    map[m[1].trim()] = m[2].trim();
  }
  return map;
}

/** Parse abilities list from a TTS Description string */
export const ABILITIES_HEADER = '[dc61ed]Abilities[-]';

export function parseAbilitiesFromDescription(description) {
  if (!description.includes(ABILITIES_HEADER)) return [];
  const part = description.split(ABILITIES_HEADER)[1];
  return part.split('\r\n').map(l => l.trim()).filter(Boolean);
}
