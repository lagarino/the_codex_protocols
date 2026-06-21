/**
 * Profile save/load — persists user choices to localStorage keyed by filename.
 *
 * Profile shape:
 * {
 *   fontScale:         number,
 *   attachments:       { [leaderId]: Attachment },
 *   excludedAbilities: { [unitId]: string[] },
 * }
 */

const PREFIX = 'nab_profile_';

function profileKey(filename) {
  return PREFIX + filename.replace(/\.json$/i, '');
}

export function saveProfile(filename, profile) {
  try {
    localStorage.setItem(profileKey(filename), JSON.stringify(profile));
  } catch (e) {
    console.warn('Could not save profile:', e);
  }
}

export function loadProfile(filename) {
  try {
    const raw = localStorage.getItem(profileKey(filename));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function deleteProfile(filename) {
  try {
    localStorage.removeItem(profileKey(filename));
  } catch { /* ignore */ }
}
