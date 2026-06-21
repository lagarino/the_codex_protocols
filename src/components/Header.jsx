import { useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useStore from '../state/store.js';
import { generateOutput } from '../engine/output.js';
import { buildPrintOutput } from '../engine/print.js';
import { generateYellowscribe } from '../engine/yellowscribe.js';
import { showToast } from './Toast.jsx';

export default function Header() {
  const fileInputRef  = useRef(null);
  const navigate      = useNavigate();
  const location      = useLocation();
  const [ysUploading, setYsUploading] = useState(false);
  const [ysCode,      setYsCode]      = useState(null);

  const { rawData, filename, format, leaders, groups, characters,
          attachments, excludedAbilities, fontScale,
          loadFile, setFontScale } = useStore();

  const hasData  = !!rawData;
  const isTTS    = format === 'tts';
  const onBuilder = location.pathname === '/';
  const onFilter  = location.pathname === '/filter';

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        loadFile(data, file.name);
        navigate('/');
      } catch (err) {
        alert('Failed to parse JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleExport() {
    const armyState = { leaders, groups, characters, attachments, excludedAbilities, fontScale };
    const output = generateOutput(rawData, armyState);
    const json   = JSON.stringify(output, null, 2);
    const blob   = new Blob([json], { type: 'application/json' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href       = url;
    a.download   = filename.replace(/\.json$/i, '') + '_modified.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportYellowscribe() {
    const armyState = { leaders, groups, characters, attachments, excludedAbilities };
    const output = generateYellowscribe(rawData, format, armyState);
    setYsUploading(true);
    try {
      const res = await fetch('/api/yellowscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(output),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const { code } = await res.json();
      setYsCode(code);
    } catch {
      showToast('Yellowscribe upload failed — downloading JSON instead', 'error');
      const json = JSON.stringify(output, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = filename.replace(/\.json$/i, '') + '_yellowscribe.json';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setYsUploading(false);
    }
  }

  function handlePrint() {
    const armyState = { leaders, groups, characters, attachments, excludedAbilities };
    const html = buildPrintOutput(rawData, format, armyState);
    const win  = window.open('', '_blank', 'width=1200,height=900');
    if (!win) { alert('Pop-up blocked — please allow pop-ups for this page'); return; }
    win.document.write(html);
    win.document.close();
  }

  return (
    <>
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 24px', borderBottom: '1px solid var(--border)',
      background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 20, fontWeight: 700,
                    letterSpacing: '0.12em', color: 'var(--gold)', textTransform: 'uppercase' }}>
        Necron <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>Army Builder</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Font size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                      padding: '0 12px', borderLeft: '1px solid var(--border)',
                      borderRight: '1px solid var(--border)' }}>
          <label style={{ fontFamily: 'Rajdhani', fontSize: 11, letterSpacing: '0.08em',
                          textTransform: 'uppercase', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
            Font
          </label>
          <input type="range" min={6} max={26} step={1} value={fontScale}
                 onChange={e => setFontScale(Number(e.target.value))}
                 style={{ width: 72, accentColor: 'var(--gold)', cursor: 'pointer' }} />
          <span style={{ fontFamily: 'Rajdhani', fontSize: 13, color: 'var(--gold)',
                         minWidth: 22, textAlign: 'right' }}>
            {fontScale}
          </span>
        </div>

        {/* Load */}
        <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()}>
          ⬆ Load JSON
        </button>
        <input ref={fileInputRef} type="file" accept=".json"
               style={{ display: 'none' }} onChange={handleFileChange} />

        {/* Filter */}
        <button className="btn btn-ghost" disabled={!hasData}
                onClick={() => navigate(onFilter ? '/' : '/filter')}
                style={{ borderColor: onFilter ? 'var(--gold-dim)' : undefined,
                         color:       onFilter ? 'var(--gold)'     : undefined }}>
          {onFilter ? '← Back' : '⊘ Filter Abilities'}
        </button>

        {/* Export (TTS only) */}
        <button className="btn btn-primary" disabled={!hasData || !isTTS}
                title={!isTTS ? 'Export to TTS JSON is only available for TTS files' : ''}
                onClick={handleExport}>
          ⬇ Export JSON
        </button>

        {/* Export Yellowscribe */}
        <button className="btn btn-ghost" disabled={!hasData || ysUploading}
                onClick={handleExportYellowscribe}>
          {ysUploading ? 'Uploading…' : '⬆ Export Yellowscribe'}
        </button>

        {/* Print */}
        <button className="btn btn-ghost" disabled={!hasData} onClick={handlePrint}>
          ⎙ Print Cards
        </button>
      </div>
    </header>
    {ysCode && <YellowscribeCodeModal code={ysCode} onClose={() => setYsCode(null)} />}
    </>
  );
}

function YellowscribeCodeModal({ code, onClose }) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(3px)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border-lit)',
        borderRadius: 8, padding: '28px 32px', width: 'min(400px, 90vw)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div>
          <div style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 700,
                        letterSpacing: '0.06em', color: 'var(--gold)', marginBottom: 4 }}>
            Army Uploaded
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            Enter this code in Yellowscribe to load your army:
          </div>
        </div>

        <div style={{
          fontFamily: 'Rajdhani', fontSize: 40, fontWeight: 700, letterSpacing: '0.25em',
          color: 'var(--text)', textAlign: 'center',
          background: 'var(--card)', border: '1px solid var(--border-lit)',
          borderRadius: 6, padding: '16px 20px',
        }}>
          {code}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={copyCode}>
            {copied ? '✓ Copied' : 'Copy code'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Dismiss</button>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center' }}>
          Code expires after 10 minutes of inactivity
        </div>
      </div>
    </div>
  );
}
