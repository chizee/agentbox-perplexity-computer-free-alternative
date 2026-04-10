const express = require('express');
const { execSync, exec } = require('child_process');
const { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const WORK_DIR = '/workspace';

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Execute command
app.post('/exec', async (req, res) => {
  try {
    const { command, timeout = 30000, cwd } = req.body;
    if (!command) return res.status(400).json({ error: 'command required' });

    const output = execSync(command, {
      timeout,
      encoding: 'utf-8',
      cwd: cwd || WORK_DIR,
      env: { ...process.env, HOME: WORK_DIR },
    });
    res.json({ stdout: output, exitCode: 0 });
  } catch (e) {
    res.json({
      stdout: e.stdout || '',
      stderr: e.stderr || '',
      exitCode: e.status || 1,
    });
  }
});

// Read file
app.get('/fs/read', (req, res) => {
  try {
    const filePath = path.resolve(WORK_DIR, req.query.path);
    if (!existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    const content = readFileSync(filePath, 'utf-8');
    res.json({ path: filePath, content });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Write file
app.post('/fs/write', (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    const absPath = path.resolve(WORK_DIR, filePath);
    const dir = path.dirname(absPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(absPath, content, 'utf-8');
    res.json({ ok: true, path: absPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List directory
app.get('/fs/ls', (req, res) => {
  try {
    const dirPath = path.resolve(WORK_DIR, req.query.path || '.');
    if (!existsSync(dirPath)) return res.status(404).json({ error: 'Directory not found' });
    const entries = readdirSync(dirPath).map(name => {
      const fullPath = path.join(dirPath, name);
      const stat = statSync(fullPath);
      return {
        name,
        type: stat.isDirectory() ? 'directory' : 'file',
        size: stat.size,
        modified: stat.mtime.toISOString(),
      };
    });
    res.json({ path: dirPath, entries });
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
    const absPath = path.resolve(WORK_DIR, filePath);
    if (!existsSync(absPath)) return res.status(404).json({ error: 'File not found' });

    let content = readFileSync(absPath, 'utf-8');

    if (!content.includes(old_string)) {
      return res.status(400).json({ error: 'old_string not found in file' });
    }

    if (replaceAll) {
      content = content.split(old_string).join(new_string);
    } else {
      content = content.replace(old_string, new_string);
    }

    writeFileSync(absPath, content, 'utf-8');
    res.json({ ok: true, path: absPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete file
app.delete('/fs/delete', (req, res) => {
  try {
    const filePath = path.resolve(WORK_DIR, req.query.path);
    if (!existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    unlinkSync(filePath);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// System info
app.get('/info', (req, res) => {
  try {
    const info = {
      hostname: execSync('hostname', { encoding: 'utf-8' }).trim(),
      os: execSync('uname -a', { encoding: 'utf-8' }).trim(),
      uptime: execSync('uptime', { encoding: 'utf-8' }).trim(),
      memory: execSync('free -h 2>/dev/null || echo "N/A"', { encoding: 'utf-8' }).trim(),
      disk: execSync('df -h / 2>/dev/null || echo "N/A"', { encoding: 'utf-8' }).trim(),
    };
    res.json(info);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Shell sandbox API listening on port ${PORT}`);
});
