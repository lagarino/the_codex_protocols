import { useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useStore from '../state/store.js';
import { generateOutput } from '../engine/output.js';
import { buildPrintOutput } from '../engine/print.js';
import { generateYellowscribe } from '../engine/yellowscribe.js';

export default function Header() {
  const fileInputRef = useRef(null);
  const navigate     = useNavigate();
  const location     = useLocation();

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

  function handleExportYellowscribe() {
    const armyState = { leaders, groups, characters, attachments, excludedAbilities };
    const output = generateYellowscribe(rawData, format, armyState);
    const json   = JSON.stringify(output, null, 2);
    const blob   = new Blob([json], { type: 'application/json' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href       = url;
    a.download   = filename.replace(/\.json$/i, '') + '_yellowscribe.json';
    a.click();
    URL.revokeObjectURL(url);
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
        <button className="btn btn-ghost" disabled={!hasData}
                onClick={handleExportYellowscribe}>
          ⬇ Export Yellowscribe
        </button>

        {/* Print */}
        <button className="btn btn-ghost" disabled={!hasData} onClick={handlePrint}>
          ⎙ Print Cards
        </button>
      </div>
    </header>
  );
}
