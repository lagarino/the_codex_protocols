/**
 * Detect the format of a loaded JSON file.
 * @param {object} data
 * @returns {'tts' | 'yellowscribe' | null}
 */
export function detectFormat(data) {
  if (data && data.ObjectStates) return 'tts';
  if (data && data.units && data.edition) return 'yellowscribe';
  return null;
}
