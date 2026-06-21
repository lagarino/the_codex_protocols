import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../state/store.js';
import AbilityModal from '../components/AbilityModal.jsx';
import { showToast } from '../components/Toast.jsx';

export default function Builder() {
  const { rawData, leaders, groups, attachments, detach, dropIsBlocked } = useStore();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null); // { leaderId, groupUuid }

  if (!rawData) return <EmptyState />;

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr',
                  minHeight: 0, overflow: 'hidden' }}>

      {/* Leaders panel */}
      <div style={{ borderRight: '1px solid var(--border)', background: 'var(--surface)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <PanelHeader>Leaders &amp; Support</PanelHeader>
        <div style={{ flex: 1, overflowY: 'auto', padding: 12,
                      display: 'flex', flexDirection: 'column', gap: 8 }}>
          {leaders.map(leader => (
            <LeaderCard key={leader.id} leader={leader} />
          ))}
        </div>
      </div>

      {/* Bodyguard grid */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <PanelHeader>Bodyguard Units</PanelHeader>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16,
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: 12, alignContent: 'start' }}>
          {groups.map(group => (
            <BodyguardSlot key={group.uuid} group={group}
                           onDrop={(leaderId) => {
                             if (dropIsBlocked(leaderId, group.uuid)) {
                               const leader = leaders.find(l => l.id === leaderId);
                               const existing = attachments.get(leaderId);
                               showToast(
                                 existing
                                   ? `${leader?.name} is already attached to another unit`
                                   : `This unit already has a ${leader?.role} attached`,
                                 'error'
                               );
                               return;
                             }
                             setModal({ leaderId, groupUuid: group.uuid });
                           }}
                           onEdit={(leaderId) => setModal({ leaderId, groupUuid: group.uuid })}
                           onDetach={(leaderId) => {
                             detach(leaderId);
                             showToast('Leader detached', 'success');
                           }}
            />
          ))}
        </div>
      </div>

      {/* Ability modal */}
      {modal && (
        <AbilityModal
          leaderId={modal.leaderId}
          groupUuid={modal.groupUuid}
          onClose={() => {
            setModal(null);
            showToast('Attachment saved', 'success');
          }}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function PanelHeader({ children }) {
  return (
    <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      <div style={{ fontFamily: 'Rajdhani', fontSize: 11, fontWeight: 600,
                    letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
        {children}
      </div>
    </div>
  );
}

function LeaderCard({ leader }) {
  const { attachments } = useStore();
  const att      = attachments.get(leader.id);
  const attached = !!att;

  function onDragStart(e) {
    if (attached) { e.preventDefault(); return; }
    e.dataTransfer.setData('leaderId', leader.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div
      className="unit-card"
      draggable={!attached}
      onDragStart={onDragStart}
      style={{
        cursor: attached ? 'default' : 'grab',
        borderLeft: '3px solid var(--gold-dim)',
        opacity: attached ? 0.45 : 1,
        ...(attached ? {} : {
          '--shimmer': 'linear-gradient(105deg, transparent 40%, rgba(200,169,110,0.07) 50%, transparent 60%)',
        }),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                    gap: 8, marginBottom: 6 }}>
        <div className="card-name">{leader.name}</div>
        <span className={`card-role role-${leader.role.toLowerCase()}`}>{leader.role}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
        {leader.abilities.map(a => a.name).join(' · ') || 'No abilities'}
      </div>
      {att && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {att.abilitiesForward.map(a  => <span key={a}  className="pill inherited">{a}</span>)}
          {att.abilitiesReverse.map(a  => <span key={a}  className="pill inherited-back">{a}</span>)}
        </div>
      )}
    </div>
  );
}

function BodyguardSlot({ group, onDrop, onEdit, onDetach }) {
  const { attachments, leaders } = useStore();
  const [dragOver, setDragOver] = useState(false);

  // Find all leaders attached to this slot
  const slotAttachments = [];
  attachments.forEach((att, lid) => {
    if (att.groupUuid === group.uuid) {
      const l = leaders.find(l => l.id === lid);
      if (l) slotAttachments.push(l);
    }
  });

  const filledRoles = new Set(slotAttachments.map(l => l.role));
  const isFull = filledRoles.has('Leader') && filledRoles.has('Support');

  return (
    <div
      className="unit-card"
      style={{
        borderLeft: `3px solid ${slotAttachments.length ? 'var(--gold-dim)' : 'var(--border)'}`,
        minHeight: 90,
        outline: dragOver ? '1px solid var(--blue)' : undefined,
        boxShadow: dragOver ? '0 0 0 1px var(--blue), inset 0 0 20px rgba(74,158,255,0.12)' : undefined,
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
      onDrop={e => {
        e.preventDefault();
        setDragOver(false);
        const leaderId = e.dataTransfer.getData('leaderId');
        if (leaderId) onDrop(leaderId);
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                    gap: 8, marginBottom: 6 }}>
        <div className="card-name">{group.name}</div>
        <span className="count-badge">{group.models} model{group.models !== 1 ? 's' : ''}</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {group.abilities.map(a => <span key={a.name} className="pill">{a.name}</span>)}
      </div>

      {slotAttachments.map(leader => (
        <div key={leader.id} style={{
          background: 'rgba(200,169,110,0.06)', border: '1px solid var(--gold-dim)',
          borderRadius: 4, padding: '8px 10px', marginTop: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span style={{ fontFamily: 'Rajdhani', fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>
            ⚔ {leader.name}
            <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 4 }}>{leader.role}</span>
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => onEdit(leader.id)}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => onDetach(leader.id)}>Detach</button>
          </div>
        </div>
      ))}

      {!isFull && dragOver && (
        <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--blue)',
                      fontFamily: 'Rajdhani', fontSize: 12, letterSpacing: '0.1em',
                      textTransform: 'uppercase' }}>
          Drop leader here
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  const fileInputRef = useState(null);
  const { loadFile } = useStore();

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        loadFile(JSON.parse(ev.target.result), file.name);
      } catch (err) {
        alert('Failed to parse JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 20,
                  minHeight: 400, textAlign: 'center', padding: 40 }}>
      <div style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700,
                    color: 'var(--text-dim)' }}>
        No Army Loaded
      </div>
      <p style={{ color: 'var(--text-faint)', maxWidth: 320, lineHeight: 1.6 }}>
        Load a Tabletop Simulator or Yellowscribe save file to begin.
      </p>
      <label
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          border: '2px dashed var(--border-lit)', borderRadius: 8, padding: '28px 40px',
          cursor: 'pointer', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 10,
        }}
      >
        <div style={{ fontFamily: 'Rajdhani', fontSize: 14, fontWeight: 600,
                      letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)' }}>
          Drop JSON here
        </div>
        <div style={{ color: 'var(--text-faint)', fontSize: 11 }}>or click to browse</div>
        <input type="file" accept=".json" style={{ display: 'none' }}
               onChange={e => { if (e.target.files[0]) readFile(e.target.files[0]); }} />
      </label>
    </div>
  );
}
