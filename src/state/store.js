/**
 * Central army state managed by Zustand.
 *
 * All state mutations go through named actions here — components never
 * mutate state directly. This makes every action independently testable.
 */

import { create } from 'zustand';
import { detectFormat }     from '../parser/detect.js';
import { parseTTS }         from '../parser/tts.js';
import { parseYellowscribe } from '../parser/yellowscribe.js';
import { saveProfile, loadProfile } from './profile.js';

const useStore = create((set, get) => ({
  // ── Raw data ────────────────────────────────────────────────────────────
  rawData:  null,
  filename: '',
  format:   'tts',  // 'tts' | 'yellowscribe'

  // ── Army model ──────────────────────────────────────────────────────────
  leaders:    [],
  groups:     [],
  characters: [],

  // ── User choices ─────────────────────────────────────────────────────────
  /** @type {Map<string, { leaderId, groupUuid, abilitiesForward, abilitiesReverse }>} */
  attachments: new Map(),

  /** @type {Map<string, Set<string>>}  unitId → set of excluded ability names */
  excludedAbilities: new Map(),

  fontScale: 20,

  // ── Saved profile (set when file loads, user can dismiss or apply) ───────
  pendingProfile: null,

  // ── File loading ─────────────────────────────────────────────────────────

  loadFile(data, filename) {
    const format = detectFormat(data);
    if (!format) throw new Error('Unrecognised file format');

    const parsed = format === 'tts' ? parseTTS(data) : parseYellowscribe(data);
    const profile = loadProfile(filename);

    set({
      rawData:           data,
      filename,
      format,
      leaders:           parsed.leaders,
      groups:            parsed.groups,
      characters:        parsed.characters,
      attachments:       new Map(),
      excludedAbilities: new Map(),
      pendingProfile:    profile,
    });
  },

  // ── Profile ───────────────────────────────────────────────────────────────

  applyPendingProfile() {
    const { pendingProfile, leaders, groups } = get();
    if (!pendingProfile) return;

    const attachments = new Map();
    Object.entries(pendingProfile.attachments || {}).forEach(([id, att]) => {
      const leaderExists = leaders.some(l => l.id === id);
      const groupExists  = groups.some(g => g.uuid === att.groupUuid);
      if (leaderExists && groupExists) attachments.set(id, att);
    });

    const excludedAbilities = new Map();
    Object.entries(pendingProfile.excludedAbilities || {}).forEach(([id, names]) => {
      excludedAbilities.set(id, new Set(names));
    });

    set({
      fontScale: pendingProfile.fontScale ?? get().fontScale,
      attachments,
      excludedAbilities,
      pendingProfile: null,
    });

    get()._persist();
  },

  dismissPendingProfile() {
    set({ pendingProfile: null });
  },

  _persist() {
    const { filename, fontScale, attachments, excludedAbilities } = get();
    if (!filename) return;
    saveProfile(filename, {
      fontScale,
      attachments: Object.fromEntries([...attachments.entries()]),
      excludedAbilities: Object.fromEntries(
        [...excludedAbilities.entries()].map(([id, s]) => [id, [...s]])
      ),
    });
  },

  // ── Attachments ───────────────────────────────────────────────────────────

  attach(leaderId, groupUuid, abilitiesForward, abilitiesReverse) {
    const attachments = new Map(get().attachments);
    attachments.set(leaderId, { leaderId, groupUuid, abilitiesForward, abilitiesReverse });
    set({ attachments });
    get()._persist();
  },

  detach(leaderId) {
    const attachments = new Map(get().attachments);
    attachments.delete(leaderId);
    set({ attachments });
    get()._persist();
  },

  // ── Ability filtering ─────────────────────────────────────────────────────

  toggleAbility(unitId, abilityName, include) {
    const excludedAbilities = new Map(get().excludedAbilities);
    if (!excludedAbilities.has(String(unitId))) {
      excludedAbilities.set(String(unitId), new Set());
    }
    const set_ = excludedAbilities.get(String(unitId));
    if (include) {
      set_.delete(abilityName);
    } else {
      set_.add(abilityName);
    }
    set({ excludedAbilities });
    get()._persist();
  },

  selectAllAbilities() {
    set({ excludedAbilities: new Map() });
    get()._persist();
  },

  clearAllAbilities(allPairs) {
    // allPairs: Array<[unitId, abilityName]>
    const excludedAbilities = new Map(get().excludedAbilities);
    allPairs.forEach(([uid, name]) => {
      const key = String(uid);
      if (!excludedAbilities.has(key)) excludedAbilities.set(key, new Set());
      excludedAbilities.get(key).add(name);
    });
    set({ excludedAbilities });
    get()._persist();
  },

  // ── Font scale ────────────────────────────────────────────────────────────

  setFontScale(fontScale) {
    set({ fontScale });
    get()._persist();
  },

  // ── Constraint helpers ────────────────────────────────────────────────────

  /** True if dropping `leaderId` onto `groupUuid` would violate a rule. */
  dropIsBlocked(leaderId, groupUuid) {
    const { leaders, attachments } = get();
    const leader = leaders.find(l => l.id === leaderId);
    if (!leader) return true;
    const existing = attachments.get(leaderId);
    // Same slot → editing, always fine
    if (existing?.groupUuid === groupUuid) return false;
    // Leader already attached to a different group
    if (existing) return true;
    // Target group already has a unit of this role
    for (const [lid, att] of attachments.entries()) {
      if (att.groupUuid !== groupUuid) continue;
      const other = leaders.find(l => l.id === lid);
      if (other?.role === leader.role) return true;
    }
    return false;
  },

  abilityIncluded(unitId, abilityName) {
    const excluded = get().excludedAbilities.get(String(unitId));
    return !excluded || !excluded.has(abilityName);
  },
}));

export default useStore;
