const express = require('express');
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs');
const pathModule = require('path');

const WORK_DIR = '/workspace';

const app = express();
app.use(express.json());

let browser, context, page;
let refCounter = 0;
let lastRefMap = new Map(); // ref -> { role, name }

async function init() {
  browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--display=:99',
      '--start-maximized',
      '--window-size=1920,1080',
      '--window-position=0,0',
      '--kiosk',
    ],
  });
  context = await browser.newContext({ viewport: null });
  page = await context.newPage();
  await page.goto('about:blank');
}

function getActivePage() {
  const pages = context.pages();
  return pages[pages.length - 1] || page;
}

// Get accessibility tree via CDP
async function getAccessibilityTree(p) {
  const cdp = await p.context().newCDPSession(p);
  try {
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');

    // Build a lookup by nodeId (coerce to string since childIds are strings)
    const nodeMap = new Map();
    for (const n of nodes) nodeMap.set(String(n.nodeId), n);

    refCounter = 0;
    lastRefMap = new Map();

    function processNode(axNode) {
      if (!axNode) return null;

      const role = axNode.role?.value || '';
      const name = axNode.name?.value || '';
      const value = axNode.value?.value;

      // Process children first (always, even for ignored nodes)
      const children = [];
      if (axNode.childIds) {
        for (const childId of axNode.childIds) {
          const childNode = nodeMap.get(String(childId));
          if (childNode) {
            const processed = processNode(childNode);
            if (processed) {
              if (Array.isArray(processed)) children.push(...processed);
              else children.push(processed);
            }
          }
        }
      }

      // Ignored nodes, generic/none/InlineTextBox — flatten children up
      const skipRoles = ['none', 'generic', 'InlineTextBox'];
      if (axNode.ignored || skipRoles.includes(role)) {
        return children.length > 0 ? children : null;
      }

      // Skip StaticText with no name
      if (role === 'StaticText' && !name.trim()) {
        return null;
      }

      const ref = `ref_${++refCounter}`;
      lastRefMap.set(ref, { role, name });

      const entry = { ref, role };
      if (name) entry.name = name;
      if (value !== undefined) entry.value = value;
      if (children.length > 0) entry.children = children;

      return entry;
    }

    const rootNode = nodes.find(n =>
      n.role?.value === 'RootWebArea' || n.role?.value === 'WebArea'
    ) || nodes[0];

    return processNode(rootNode);
  } finally {
    await cdp.detach();
  }
}

async function locateElement(p, { ref, selector, text }) {
  if (selector) return p.locator(selector);
  if (text) return p.getByText(text, { exact: false });
  if (ref) {
    const info = lastRefMap.get(ref);
    if (!info) throw new Error(`Ref ${ref} not found. Take a new snapshot first.`);
    if (info.role && info.name) {
      return p.getByRole(info.role, { name: info.name });
    }
    if (info.name) return p.getByText(info.name);
    throw new Error(`Cannot locate element for ref ${ref}`);
  }
  throw new Error('Provide ref, selector, or text');
}

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Screenshot
app.get('/screenshot', async (req, res) => {
  try {
    const p = getActivePage();
    const buf = await p.screenshot({ type: 'png' });
    res.set('Content-Type', 'image/png').send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Accessibility snapshot
app.get('/browser/snapshot', async (req, res) => {
  try {
    const p = getActivePage();
    const tree = await getAccessibilityTree(p);
    res.json({ url: p.url(), title: await p.title(), tree });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Read page as clean plain text
app.get('/browser/text', async (req, res) => {
  try {
    const p = getActivePage();
    const text = await p.innerText('body');
    // Clean up excessive whitespace
    const cleaned = text.replace(/\n{3,}/g, '\n\n').trim();
    res.json({ url: p.url(), title: await p.title(), text: cleaned });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Navigate
app.post('/browser/navigate', async (req, res) => {
  try {
    if (!req.body.url) {
      return res.status(400).json({ error: "url is required. Provide a valid URL like https://example.com" });
    }
    const p = getActivePage();
    await p.goto(req.body.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    res.json({ url: p.url(), title: await p.title() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Click
app.post('/browser/click', async (req, res) => {
  try {
    const p = getActivePage();
    const el = await locateElement(p, req.body);
    await el.first().click({ timeout: 5000 });
    await p.waitForTimeout(500);
    res.json({ ok: true, url: p.url() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Type
app.post('/browser/type', async (req, res) => {
  try {
    const p = getActivePage();
    const el = await locateElement(p, req.body);
    const value = req.body.value || req.body.text || '';
    if (req.body.clear !== false) {
      await el.first().fill(value, { timeout: 5000 });
    } else {
      await el.first().pressSequentially(value, { delay: 50 });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Scroll
app.post('/browser/scroll', async (req, res) => {
  try {
    const p = getActivePage();
    const direction = req.body.direction || 'down';
    const amount = req.body.amount || 500;
    const deltaY = direction === 'up' ? -amount : direction === 'down' ? amount : 0;
    const deltaX = direction === 'left' ? -amount : direction === 'right' ? amount : 0;
    await p.mouse.wheel(deltaX, deltaY);
    await p.waitForTimeout(300);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Back / Forward
app.post('/browser/back', async (req, res) => {
  try {
    const p = getActivePage();
    await p.goBack({ waitUntil: 'domcontentloaded' });
    res.json({ url: p.url(), title: await p.title() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/browser/forward', async (req, res) => {
  try {
    const p = getActivePage();
    await p.goForward({ waitUntil: 'domcontentloaded' });
    res.json({ url: p.url(), title: await p.title() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Tabs
app.get('/browser/tabs', async (req, res) => {
  try {
    const pages = context.pages();
    const tabs = await Promise.all(pages.map(async (p, i) => ({
      index: i,
      url: p.url(),
      title: await p.title(),
      active: p === getActivePage(),
    })));
    res.json({ tabs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/browser/tab', async (req, res) => {
  try {
    const pages = context.pages();
    const idx = req.body.index;
    if (idx < 0 || idx >= pages.length) throw new Error('Invalid tab index');
    page = pages[idx];
    await page.bringToFront();
    res.json({ url: page.url(), title: await page.title() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Filesystem endpoints ---

// Read file
app.get('/fs/read', (req, res) => {
  try {
    const filePath = pathModule.resolve(WORK_DIR, req.query.path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ path: filePath, content });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Write file
app.post('/fs/write', (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    const absPath = pathModule.resolve(WORK_DIR, filePath);
    const dir = pathModule.dirname(absPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(absPath, content, 'utf-8');
    res.json({ ok: true, path: absPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Edit file (find and replace)
app.post('/fs/edit', (req, res) => {
  try {
    const { path: filePath, old_string, new_string, replace_all: replaceAll } = req.body;
    if (!filePath || old_string === undefined || new_string === undefined) {
      return res.status(400).json({ error: 'path, old_string, and new_string required' });
    }
    const absPath = pathModule.resolve(WORK_DIR, filePath);
    if (!fs.existsSync(absPath)) return res.status(404).json({ error: 'File not found' });

    let content = fs.readFileSync(absPath, 'utf-8');
    if (!content.includes(old_string)) {
      return res.status(400).json({ error: 'old_string not found in file' });
    }

    content = replaceAll ? content.split(old_string).join(new_string) : content.replace(old_string, new_string);
    fs.writeFileSync(absPath, content, 'utf-8');
    res.json({ ok: true, path: absPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List directory
app.get('/fs/ls', (req, res) => {
  try {
    const dirPath = pathModule.resolve(WORK_DIR, req.query.path || '.');
    if (!fs.existsSync(dirPath)) return res.status(404).json({ error: 'Directory not found' });
    const entries = fs.readdirSync(dirPath).map(name => {
      const fullPath = pathModule.join(dirPath, name);
      const stat = fs.statSync(fullPath);
      return { name, type: stat.isDirectory() ? 'directory' : 'file', size: stat.size, modified: stat.mtime.toISOString() };
    });
    res.json({ path: dirPath, entries });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete file
app.delete('/fs/delete', (req, res) => {
  try {
    const filePath = pathModule.resolve(WORK_DIR, req.query.path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// System info
app.get('/info', (req, res) => {
  try {
    res.json({
      hostname: execSync('hostname', { encoding: 'utf-8' }).trim(),
      os: execSync('uname -a', { encoding: 'utf-8' }).trim(),
      uptime: execSync('uptime', { encoding: 'utf-8' }).trim(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Exec shell command
app.post('/exec', async (req, res) => {
  try {
    const output = execSync(req.body.command, {
      timeout: 30000,
      encoding: 'utf-8',
      cwd: '/workspace',
    });
    res.json({ stdout: output, exitCode: 0 });
  } catch (e) {
    res.json({ stdout: e.stdout || '', stderr: e.stderr || '', exitCode: e.status || 1 });
  }
});

const PORT = process.env.PORT || 8080;

init().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sandbox API listening on port ${PORT}`);
  });
}).catch(e => {
  console.error('Failed to initialize:', e);
  process.exit(1);
});
