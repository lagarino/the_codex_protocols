import { useState, useEffect } from 'react';
import useStore from '../state/store.js';

export default function AbilityModal({ leaderId, groupUuid, onClose }) {
  const { leaders, groups, attachments, attach } = useStore();

  const leader = leaders.find(l => l.id === leaderId);
  const group  = groups.find(g => g.uuid === groupUuid);
  const existing = attachments.get(leaderId);
  const sameSlot = existing?.groupUuid === groupUuid;

  const [fwd, setFwd] = useState(new Set(sameSlot ? existing.abilitiesForward  : []));
  const [rev, setRev] = useState(new Set(sameSlot ? existing.abilitiesReverse  : []));

  if (!leader || !group) return null;

  function toggle(set, setFn, name) {
    const next = new Set(set);
    next.has(name) ? next.delete(name) : next.add(name);
    setFn(next);
  }

  function confirm() {
    attach(leaderId, groupUuid, [...fwd], [...rev]);
    onClose();
  }

  const leaderAbils = leader.abilities.filter(a => a.name !== 'Leader' && a.name !== 'Support');
  const groupAbils  = group.abilities;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(3px)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border-lit)',
        borderRadius: 8, width: 'min(680px, 95vw)', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)',
                      display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 700,
                          letterSpacing: '0.06em', color: 'var(--gold)' }}>
              {leader.name} ↔ {group.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
              Select which abilities to share between this leader and their bodyguard unit.
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex',
                      flexDirection: 'column', gap: 20 }}>
          <AbilitySection
            title={`${leader.name} → ${group.name}`}
            description={`Abilities from ${leader.name} copied to every model in the bodyguard:`}
            abilities={leaderAbils}
            selected={fwd}
            selectedClass="selected"
            onToggle={name => toggle(fwd, setFwd, name)}
          />
          <AbilitySection
            title={`${group.name} → ${leader.name}`}
            description={`Abilities from ${group.name} copied to the leader:`}
            abilities={groupAbils}
            selected={rev}
            selectedClass="selected-back"
            onToggle={name => toggle(rev, setRev, name)}
          />
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)',
                      display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={confirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

function AbilitySection({ title, description, abilities, selected, selectedClass, onToggle }) {
  if (!abilities.length) return null;
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8 }}>
        {description}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {abilities.map(ab => (
          <AbilityRow key={ab.name} ability={ab}
                      selected={selected.has(ab.name)} selectedClass={selectedClass}
                      onToggle={() => onToggle(ab.name)} />
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontFamily: 'Rajdhani', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {children}
      <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}

function AbilityRow({ ability, selected, selectedClass, onToggle }) {
  const isGold = selectedClass === 'selected';
  const bg     = selected ? (isGold ? 'rgba(200,169,110,0.15)' : 'rgba(74,158,255,0.12)') : 'transparent';
  const border = selected ? (isGold ? 'var(--gold-dim)' : 'rgba(74,158,255,0.3)') : 'transparent';
  const checkBg = selected ? (isGold ? 'var(--gold)' : 'var(--blue)') : 'transparent';

  return (
    <div onClick={onToggle} style={{
      display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 4,
      border: `1px solid ${border}`, background: bg, cursor: 'pointer',
      transition: 'background 0.12s, border-color 0.12s', alignItems: 'flex-start',
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: 3, flexShrink: 0, marginTop: 1,
        border: `1px solid ${selected ? checkBg : 'var(--border-lit)'}`,
        background: checkBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s',
      }}>
        {selected && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="#0a0a0f" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Rajdhani', fontSize: 14, fontWeight: 600,
                      color: 'var(--text)', letterSpacing: '0.02em', marginBottom: 2 }}>
          {ability.name}
        </div>
        {ability.desc && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.55 }}>
            {ability.desc}
          </div>
        )}
      </div>
    </div>
  );
}
