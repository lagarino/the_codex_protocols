import { useNavigate } from 'react-router-dom';
import useStore from '../state/store.js';
import { parseFullUnitTTS }  from '../parser/tts.js';
import { parseFullUnit as parseFullUnitYS } from '../parser/yellowscribe.js';

function parseFullUnit(rawData, format, id) {
  return format === 'yellowscribe'
    ? parseFullUnitYS(rawData, id)
    : parseFullUnitTTS(rawData, id);
}

export default function Filter() {
  const navigate = useNavigate();
  const { rawData, format, leaders, groups, characters,
          attachments, excludedAbilities,
          toggleAbility, selectAllAbilities, clearAllAbilities, abilityIncluded } = useStore();

  if (!rawData) { navigate('/'); return null; }

  const blocks = buildBlocks(leaders, groups, characters, attachments);
  const allPairs = collectAllPairs(blocks, rawData, format);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
                  background: 'var(--void)' }}>
      {/* Sub-header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 24px',
                    borderBottom: '1px solid var(--border)', background: 'var(--surface)',
                    gap: 12, flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          Unchecked abilities are hidden from print cards and TTS export.
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={selectAllAbilities}>Select all</button>
          <button className="btn btn-ghost btn-sm" onClick={() => clearAllAbilities(allPairs)}>Clear all</button>
        </div>
      </div>

      {/* Grid of unit blocks */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20,
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                    gap: 14, alignContent: 'start' }}>
        {blocks.map((block, i) => (
          <FilterBlock key={i} block={block} rawData={rawData} format={format}
                       excludedAbilities={excludedAbilities}
                       toggleAbility={toggleAbility} abilityIncluded={abilityIncluded} />
        ))}
      </div>
    </div>
  );
}

// ── Block building ────────────────────────────────────────────────────────

function buildBlocks(leaders, groups, characters, attachments) {
  const blocks = [];
  const handledLeaderIds  = new Set();
  const handledGroupUuids = new Set();

  groups.forEach(group => {
    const groupAttachments = [];
    attachments.forEach((att, lid) => {
      if (att.groupUuid === group.uuid) {
        const l = leaders.find(l => l.id === lid);
        if (l) { groupAttachments.push(l); handledLeaderIds.add(lid); }
      }
    });
    if (groupAttachments.length) {
      handledGroupUuids.add(group.uuid);
      blocks.push({ type: 'attached', group, attachedLeaders: groupAttachments });
    }
  });

  leaders.forEach(l => {
    if (!handledLeaderIds.has(l.id)) blocks.push({ type: 'leader', leader: l });
  });

  characters.forEach(c => blocks.push({ type: 'character', char: c }));

  groups.forEach(g => {
    if (!handledGroupUuids.has(g.uuid)) blocks.push({ type: 'group', group: g });
  });

  return blocks;
}

function collectAllPairs(blocks, rawData, format) {
  const pairs = [];
  blocks.forEach(block => {
    if (block.type === 'attached') {
      const gu = parseFullUnit(rawData, format, block.group.indices[0]);
      if (gu) gu.ownAbilities.forEach(ab => pairs.push([block.group.uuid, ab.name]));
      block.attachedLeaders.forEach(l => {
        const lu = parseFullUnit(rawData, format, l.objIdx);
        if (lu) lu.ownAbilities.forEach(ab => pairs.push([l.id, ab.name]));
      });
    } else if (block.type === 'leader') {
      const u = parseFullUnit(rawData, format, block.leader.objIdx);
      if (u) u.ownAbilities.forEach(ab => pairs.push([block.leader.id, ab.name]));
    } else if (block.type === 'character') {
      const u = parseFullUnit(rawData, format, block.char.objIdx);
      if (u) u.ownAbilities.forEach(ab => pairs.push([String(block.char.objIdx), ab.name]));
    } else if (block.type === 'group') {
      const u = parseFullUnit(rawData, format, block.group.indices[0]);
      if (u) u.ownAbilities.forEach(ab => pairs.push([block.group.uuid, ab.name]));
    }
  });
  return pairs;
}

// ── Filter block component ────────────────────────────────────────────────

function FilterBlock({ block, rawData, format, excludedAbilities, toggleAbility, abilityIncluded }) {
  const renderAbilityList = (unitId, abilities) =>
    abilities.map(ab => (
      <AbilityToggleRow key={ab.name} unitId={String(unitId)} ability={ab}
                        included={abilityIncluded(String(unitId), ab.name)}
                        onToggle={() => toggleAbility(String(unitId), ab.name, !abilityIncluded(String(unitId), ab.name))} />
    ));

  if (block.type === 'attached') {
    const { group, attachedLeaders } = block;
    const groupUnit = parseFullUnit(rawData, format, group.indices[0]);
    return (
      <div style={blockStyle}>
        <div style={headerStyle}>
          <div style={nameStyle}>{group.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', width: '100%', marginTop: 1 }}>
            ⚔ <strong style={{ color: 'var(--gold-dim)' }}>
              {attachedLeaders.map(l => l.name).join(' & ')}
            </strong>
          </div>
        </div>
        {groupUnit && <>
          <SectionLabel>{group.name} Abilities</SectionLabel>
          {renderAbilityList(group.uuid, groupUnit.ownAbilities)}
        </>}
        {attachedLeaders.map(leader => {
          const lu = parseFullUnit(rawData, format, leader.objIdx);
          return lu ? <div key={leader.id}>
            <SectionLabel>{leader.name} Abilities</SectionLabel>
            {renderAbilityList(leader.id, lu.ownAbilities)}
          </div> : null;
        })}
      </div>
    );
  }

  if (block.type === 'leader') {
    const { leader } = block;
    const u = parseFullUnit(rawData, format, leader.objIdx);
    return (
      <div style={blockStyle}>
        <div style={headerStyle}>
          <div style={nameStyle}>{leader.name}</div>
          <span className={`card-role role-${leader.role.toLowerCase()}`}>{leader.role}</span>
        </div>
        {u && <>
          <SectionLabel>Abilities</SectionLabel>
          {renderAbilityList(leader.id, u.ownAbilities)}
        </>}
      </div>
    );
  }

  if (block.type === 'character') {
    const { char } = block;
    const u = parseFullUnit(rawData, format, char.objIdx);
    return (
      <div style={blockStyle}>
        <div style={headerStyle}>
          <div style={nameStyle}>{char.name}</div>
          <span className="card-role" style={{ borderColor: 'var(--text-faint)', color: 'var(--text-faint)' }}>
            Character
          </span>
        </div>
        {u && <>
          <SectionLabel>Abilities</SectionLabel>
          {renderAbilityList(String(char.objIdx), u.ownAbilities)}
        </>}
      </div>
    );
  }

  if (block.type === 'group') {
    const { group } = block;
    const u = parseFullUnit(rawData, format, group.indices[0]);
    return (
      <div style={blockStyle}>
        <div style={headerStyle}>
          <div style={nameStyle}>{group.name}</div>
          <span className="count-badge">{group.models} model{group.models !== 1 ? 's' : ''}</span>
        </div>
        {u && <>
          <SectionLabel>Abilities</SectionLabel>
          {renderAbilityList(group.uuid, u.ownAbilities)}
        </>}
      </div>
    );
  }

  return null;
}

function AbilityToggleRow({ unitId, ability, included, onToggle }) {
  return (
    <div onClick={onToggle} style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '7px 14px', cursor: 'pointer',
      borderTop: '1px solid var(--border)',
      opacity: included ? 1 : 0.4,
      transition: 'opacity 0.1s, background 0.1s',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{
        width: 15, height: 15, borderRadius: 3, flexShrink: 0, marginTop: 1,
        border: `1px solid ${included ? 'var(--gold)' : 'var(--border-lit)'}`,
        background: included ? 'var(--gold)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.1s',
      }}>
        {included && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5L3 5.5L8 1" stroke="#0a0a0f" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Rajdhani', fontSize: 13, fontWeight: 600,
                      color: 'var(--text)', letterSpacing: '0.02em' }}>
          {ability.name}
        </div>
        {ability.desc && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 2 }}>
            {ability.desc}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ padding: '6px 14px 4px', fontSize: 10, fontWeight: 600,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: 'var(--text-faint)', borderTop: '1px solid var(--border)' }}>
      {children}
    </div>
  );
}

const blockStyle = {
  background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden',
};
const headerStyle = {
  padding: '10px 14px', background: 'var(--surface)',
  borderBottom: '1px solid var(--border)',
  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
};
const nameStyle = {
  fontFamily: 'Rajdhani', fontSize: 14, fontWeight: 700,
  color: 'var(--gold)', letterSpacing: '0.03em', flex: 1,
};
