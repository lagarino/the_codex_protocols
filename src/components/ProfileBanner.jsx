import useStore from '../state/store.js';

export default function ProfileBanner() {
  const { pendingProfile, attachments, applyPendingProfile, dismissPendingProfile } = useStore();

  if (!pendingProfile) return null;

  const n = Object.keys(pendingProfile.attachments || {}).length;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 24px', background: 'rgba(200,169,110,0.08)',
      borderBottom: '1px solid rgba(200,169,110,0.2)',
      fontSize: 12, color: 'var(--text-dim)',
    }}>
      <span>
        ⚡ Saved profile found —{' '}
        <strong style={{ color: 'var(--gold)' }}>
          {n} attachment{n !== 1 ? 's' : ''} from last session
        </strong>
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={dismissPendingProfile}>
          Dismiss
        </button>
        <button className="btn btn-primary btn-sm" onClick={applyPendingProfile}>
          Restore choices
        </button>
      </div>
    </div>
  );
}
