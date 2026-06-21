import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '10mb' }));

app.post('/api/yellowscribe', async (req, res) => {
  try {
    const upstream = await fetch('https://yellowscribe.link/getArmyCode', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(req.body),
    });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` });
    }
    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Serve Vite production build when dist/ exists (production / after `npm run build`)
const dist = path.join(__dirname, '../dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.use((_, res) => res.sendFile(path.join(dist, 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
