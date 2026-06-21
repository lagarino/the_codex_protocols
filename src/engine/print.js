/**
 * Print engine.
 *
 * Builds self-contained HTML print documents from the army state.
 * Pure functions: (armyState, rawData) → HTML string. No DOM side effects.
 */

import { parseFullUnit as parseFullUnitTTS } from '../parser/tts.js';
import { parseFullUnit as parseFullUnitYS } from '../parser/yellowscribe.js';

// ── Format-aware unit lookup ──────────────────────────────────────────────

export function parseFullUnit(rawData, format, id) {
  return format === 'yellowscribe'
    ? parseFullUnitYS(rawData, id)
    : parseFullUnitTTS(rawData, id);
}

// ── Ability filtering ─────────────────────────────────────────────────────

export function filterAbilities(unitId, abilities, excludedAbilities) {
  const excluded = excludedAbilities.get(String(unitId));
  if (!excluded || excluded.size === 0) return abilities;
  return abilities.filter(ab => !excluded.has(ab.name));
}

// ── HTML fragments ────────────────────────────────────────────────────────

export function renderStatsTable(models, invuln) {
  const rows = models.map(mo => `
    <tr>
      <td>${mo.m}</td><td>${mo.t}</td><td>${mo.sv}</td>
      <td>${mo.w}</td><td>${mo.ld}</td><td>${mo.oc}</td>
    </tr>`).join('');
  const invulnRow = invuln
    ? `<tr class="invuln-row"><td colspan="6">Invulnerable Save: ${invuln}</td></tr>`
    : '';
  return `
    <table class="pc-stats">
      <thead><tr>
        <th>M</th><th>T</th><th>Sv</th><th>W</th><th>Ld</th><th>OC</th>
      </tr></thead>
      <tbody>${rows}${invulnRow}</tbody>
    </table>`;
}

export function renderWeaponsRows(weapons, fromLeader = false) {
  return weapons.map(w => {
    const cls = fromLeader ? ' class="from-leader"' : '';
    return `<tr${cls}>
      <td>${w.name}</td>
      <td>${w.range}</td><td>${w.a}</td><td>${w.bsws}</td>
      <td>${w.s}</td><td>${w.ap}</td><td>${w.d}</td>
      <td class="weapon-abilities">${w.abilities || ''}</td>
    </tr>`;
  }).join('');
}

const WEAPONS_HEAD = `<tr>
  <th style="text-align:left">Weapon</th>
  <th>Range</th><th>A</th><th>BS/WS</th>
  <th>S</th><th>AP</th><th>D</th><th>Abilities</th>
</tr>`;

export function renderAbilityBlock(abilities, cssClass = '') {
  return abilities.map(ab => `
    <div class="pc-ability">
      <div class="pc-ability-name${cssClass ? ' ' + cssClass : ''}">${ab.name}</div>
      ${ab.desc ? `<div class="pc-ability-desc">${ab.desc}</div>` : ''}
    </div>`).join('');
}

// ── Card builders ─────────────────────────────────────────────────────────

export function buildPrintCard(group, attachedLeader, rawData, format, attachments, excludedAbilities) {
  const groupUnit  = parseFullUnit(rawData, format, group.indices[0]);
  const leaderUnit = attachedLeader ? parseFullUnit(rawData, format, attachedLeader.objIdx) : null;
  const att        = attachedLeader ? attachments.get(attachedLeader.id) : null;
  if (!groupUnit) return '';

  const ranged  = groupUnit.weapons.filter(w => w.range !== 'Melee');
  const melee   = groupUnit.weapons.filter(w => w.range === 'Melee');
  const lRanged = leaderUnit ? leaderUnit.weapons.filter(w => w.range !== 'Melee') : [];
  const lMelee  = leaderUnit ? leaderUnit.weapons.filter(w => w.range === 'Melee') : [];

  // Ability bucketing
  const fwdSet = new Set(att?.abilitiesForward || []);
  const revSet = new Set(att?.abilitiesReverse || []);

  const leaderDescMap = leaderUnit
    ? Object.fromEntries(leaderUnit.ownAbilities.map(a => [a.name, a.desc]))
    : {};

  const sharedAbilities = [
    ...[...fwdSet].map(n => ({ name: n, desc: leaderDescMap[n] || groupUnit.ownAbilities.find(a => a.name === n)?.desc || '' })),
    ...[...revSet].filter(n => !fwdSet.has(n)).map(n => ({ name: n, desc: groupUnit.ownAbilities.find(a => a.name === n)?.desc || leaderDescMap[n] || '' })),
  ];
  const sharedSet = new Set([...fwdSet, ...revSet]);

  const bodyguardAbilities = groupUnit.ownAbilities.filter(a => !sharedSet.has(a.name));
  const leaderOnlyAbilities = leaderUnit
    ? leaderUnit.ownAbilities.filter(a => !sharedSet.has(a.name))
    : [];

  // Apply exclusion filters
  const groupId  = group.uuid;
  const leaderId = attachedLeader?.id;

  const visShared    = filterAbilities(groupId, sharedAbilities.filter(ab =>
    (!leaderId || !excludedAbilities.get(String(leaderId))?.has(ab.name))
  ), excludedAbilities);
  const visBodyguard = filterAbilities(groupId, bodyguardAbilities, excludedAbilities);
  const visLeader    = leaderId ? filterAbilities(leaderId, leaderOnlyAbilities, excludedAbilities) : [];

  const weaponsSection = (ranged.length || lRanged.length) ? `
    <div class="pc-section">
      <div class="pc-label">Ranged Weapons</div>
      <table class="pc-weapons">
        <thead>${WEAPONS_HEAD}</thead>
        <tbody>${renderWeaponsRows(ranged)}${renderWeaponsRows(lRanged, true)}</tbody>
      </table>
    </div>` : '';

  const meleeSection = (melee.length || lMelee.length) ? `
    <div class="pc-section">
      <div class="pc-label">Melee Weapons</div>
      <table class="pc-weapons">
        <thead>${WEAPONS_HEAD}</thead>
        <tbody>${renderWeaponsRows(melee)}${renderWeaponsRows(lMelee, true)}</tbody>
      </table>
    </div>` : '';

  const abilitiesSection = [
    visShared.length    ? `<div class="pc-section"><div class="pc-label">Whole Unit Abilities</div>${renderAbilityBlock(visShared, 'shared')}</div>` : '',
    visBodyguard.length ? `<div class="pc-section"><div class="pc-label">${leaderUnit ? groupUnit.name + ' Abilities' : 'Abilities'}</div>${renderAbilityBlock(visBodyguard)}</div>` : '',
    visLeader.length    ? `<div class="pc-section"><div class="pc-label">${leaderUnit.name} Abilities</div>${renderAbilityBlock(visLeader)}</div>` : '',
  ].join('');

  const attachedHeader = leaderUnit ? `
    <div class="pc-attached-header">
      <span>⚔ Attached: <span class="pc-attached-name">${leaderUnit.name}</span></span>
      <span style="font-size:6.5pt;color:#7a7998">${leaderUnit.keywords}</span>
    </div>` : '';

  const leaderStatsSection = leaderUnit ? `
    <div class="pc-section" style="margin-top:1.5mm">
      <div class="pc-label">${leaderUnit.name} — Stats</div>
      ${renderStatsTable(leaderUnit.models, leaderUnit.invuln)}
    </div>` : '';

  return `
    <div class="print-card">
      <div class="pc-header">
        <div>
          <div class="pc-name">${groupUnit.name}</div>
          <div class="pc-faction">${groupUnit.faction}</div>
        </div>
        <span class="pc-role-badge">${group.models} model${group.models !== 1 ? 's' : ''}</span>
      </div>
      ${attachedHeader}
      <div class="pc-body">
        ${renderStatsTable(groupUnit.models, groupUnit.invuln)}
        ${leaderStatsSection}
        ${weaponsSection}
        ${meleeSection}
        ${abilitiesSection}
        <div class="pc-keywords">
          <strong>Keywords:</strong> ${groupUnit.keywords}
          ${leaderUnit ? `&nbsp;·&nbsp;<strong>${leaderUnit.name}:</strong> ${leaderUnit.keywords}` : ''}
        </div>
      </div>
    </div>`;
}

export function buildSoloCard(unit, id, role, excludedAbilities) {
  if (!unit) return '';
  const ranged = unit.weapons.filter(w => w.range !== 'Melee');
  const melee  = unit.weapons.filter(w => w.range === 'Melee');
  const visAbilities = filterAbilities(id, unit.ownAbilities, excludedAbilities);

  const roleBadgeStyle = role === 'Character'
    ? 'border-color:#3a3a5f;color:#7a7998'
    : role === 'Support'
      ? 'border-color:rgba(74,158,255,0.3);color:#4a9eff'
      : '';

  return `
    <div class="print-card">
      <div class="pc-header">
        <div>
          <div class="pc-name">${unit.name}</div>
          <div class="pc-faction">${unit.faction}</div>
        </div>
        <span class="pc-role-badge" style="${roleBadgeStyle}">${role}</span>
      </div>
      <div class="pc-body">
        ${renderStatsTable(unit.models, unit.invuln)}
        ${ranged.length ? `
        <div class="pc-section">
          <div class="pc-label">Ranged Weapons</div>
          <table class="pc-weapons">
            <thead>${WEAPONS_HEAD}</thead>
            <tbody>${renderWeaponsRows(ranged)}</tbody>
          </table>
        </div>` : ''}
        ${melee.length ? `
        <div class="pc-section">
          <div class="pc-label">Melee Weapons</div>
          <table class="pc-weapons">
            <thead>${WEAPONS_HEAD}</thead>
            <tbody>${renderWeaponsRows(melee)}</tbody>
          </table>
        </div>` : ''}
        ${visAbilities.length ? `
        <div class="pc-section">
          <div class="pc-label">Abilities</div>
          ${renderAbilityBlock(visAbilities)}
        </div>` : ''}
        <div class="pc-keywords"><strong>Keywords:</strong> ${unit.keywords}</div>
      </div>
    </div>`;
}

// ── Full print document ───────────────────────────────────────────────────

export function buildPrintDocument(cards) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Army Cards</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: white; font-family: 'Inter', sans-serif; font-size: 7.5pt; color: #111; }
  @page { size: A4 landscape; margin: 8mm; }
  .print-grid { columns: 3; column-gap: 5mm; }
  .print-card { border: 1.5px solid #1a1a2e; border-radius: 4px; overflow: hidden;
                break-inside: avoid; page-break-inside: avoid; margin-bottom: 5mm;
                display: inline-block; width: 100%; background: white; }
  .pc-header { background: #1a1a2e; color: #c8a96e; padding: 3mm 3.5mm 2.5mm;
               display: flex; align-items: flex-end; justify-content: space-between; gap: 4mm; }
  .pc-name { font-family: 'Rajdhani', sans-serif; font-size: 13pt; font-weight: 700;
             letter-spacing: 0.04em; line-height: 1.1; }
  .pc-faction { font-size: 6pt; letter-spacing: 0.1em; text-transform: uppercase;
                color: #8a7050; margin-top: 1px; }
  .pc-role-badge { font-family: 'Rajdhani', sans-serif; font-size: 7pt; font-weight: 600;
                   letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 6px;
                   border-radius: 3px; border: 1px solid #c8a96e; white-space: nowrap;
                   flex-shrink: 0; align-self: flex-start; margin-top: 2px; }
  .pc-attached-header { background: #13131f; color: #8a9ebb; padding: 1.5mm 3.5mm;
                        font-family: 'Rajdhani', sans-serif; font-size: 9pt; font-weight: 600;
                        letter-spacing: 0.05em; border-bottom: 1px solid #2a2a3f;
                        display: flex; align-items: center; gap: 4mm; justify-content: space-between; }
  .pc-attached-name { color: #c8a96e; }
  .pc-body { padding: 2mm 3mm; }
  .pc-section { margin-bottom: 2mm; }
  .pc-label { font-size: 6pt; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase;
              color: #c8a96e; border-bottom: 0.5px solid #c8a96e; padding-bottom: 0.5mm; margin-bottom: 1.5mm; }
  .pc-stats { width: 100%; border-collapse: collapse; margin-bottom: 2mm; }
  .pc-stats th { font-size: 6pt; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
                 color: #555; text-align: center; padding: 1mm 0 0.5mm; border-bottom: 1px solid #ddd; }
  .pc-stats td { font-family: 'Rajdhani', sans-serif; font-size: 9pt; font-weight: 700;
                 text-align: center; padding: 0.5mm 1mm; color: #1a1a2e; }
  .pc-stats .invuln-row td { font-size: 7pt; font-weight: 500; color: #555; padding-top: 0; }
  .pc-weapons { width: 100%; border-collapse: collapse; margin-bottom: 1mm; }
  .pc-weapons th { font-size: 5.5pt; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
                   color: #888; text-align: center; padding: 0 1mm 0.5mm; border-bottom: 0.5px solid #eee; }
  .pc-weapons th:first-child { text-align: left; }
  .pc-weapons td { font-size: 7pt; padding: 0.5mm 1mm; text-align: center;
                   border-bottom: 0.5px solid #f0f0f0; vertical-align: top; }
  .pc-weapons td:first-child { text-align: left; font-weight: 500; }
  .pc-weapons .weapon-abilities { font-size: 6pt; color: #2a6e4a; font-style: italic; text-align: left; }
  .pc-weapons tr.from-leader td { color: #7a5030; background: #fff9f0; }
  .pc-weapons tr.from-leader td:first-child::before { content: '★ '; color: #c8a96e; }
  .pc-ability { margin-bottom: 1.5mm; }
  .pc-ability-name { font-family: 'Rajdhani', sans-serif; font-size: 8pt; font-weight: 700;
                     color: #1a1a2e; margin-bottom: 0.3mm; }
  .pc-ability-name.inherited::before { content: '★ '; color: #c8a96e; }
  .pc-ability-name.inherited { color: #8a5020; }
  .pc-ability-name.inherited-back::before { content: '↩ '; color: #4a9eff; }
  .pc-ability-name.inherited-back { color: #205080; }
  .pc-ability-name.shared::before { content: '⬡ '; color: #4ade80; }
  .pc-ability-name.shared { color: #2a6e2a; }
  .pc-ability-desc { font-size: 6.5pt; color: #444; line-height: 1.45; }
  .pc-keywords { font-size: 6pt; color: #888; margin-top: 1.5mm; padding-top: 1.5mm;
                 border-top: 0.5px solid #eee; }
  .pc-keywords strong { color: #555; }
</style>
</head>
<body>
<div class="print-grid">${cards}</div>
<script>
  document.fonts.ready.then(() => {
    window.print();
    window.addEventListener('afterprint', () => window.close());
  });
<\/script>
</body>
</html>`;
}

// ── Orchestrator ──────────────────────────────────────────────────────────

/**
 * Build all print cards and return the full HTML document string.
 *
 * @param {object} rawData
 * @param {'tts'|'yellowscribe'} format
 * @param {object} armyState - { leaders, groups, characters, attachments, excludedAbilities }
 * @returns {string} Self-contained HTML document
 */
export function buildPrintOutput(rawData, format, armyState) {
  const { leaders, groups, characters, attachments, excludedAbilities } = armyState;
  const attachedLeaderIds = new Set(attachments.keys());
  let cards = '';

  groups.forEach(group => {
    let attachedLeader = null;
    attachments.forEach((att, lid) => {
      if (att.groupUuid === group.uuid) {
        attachedLeader = leaders.find(l => l.id === lid) || null;
      }
    });
    cards += buildPrintCard(group, attachedLeader, rawData, format, attachments, excludedAbilities);
  });

  leaders.forEach(leader => {
    if (!attachedLeaderIds.has(leader.id)) {
      const unit = parseFullUnit(rawData, format, leader.objIdx);
      cards += buildSoloCard(unit, leader.id, leader.role, excludedAbilities);
    }
  });

  characters.forEach(char => {
    const unit = parseFullUnit(rawData, format, char.objIdx);
    cards += buildSoloCard(unit, String(char.objIdx), 'Character', excludedAbilities);
  });

  return buildPrintDocument(cards);
}
