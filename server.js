const express = require('express');
const cors = require('cors');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 3000;
const GPT_CMD = process.env.GPT4ALL_CMD || 'gpt4all';
const MODEL_PATH = process.env.GPT4ALL_MODEL || 'model.ggml.bin';
// GPT4ALL_ARGS is a template string, use {model} and {prompt} as placeholders
const GPT_ARGS_TEMPLATE = process.env.GPT4ALL_ARGS || '--model {model} --prompt {prompt}';

function buildArgs(prompt) {
  const tpl = GPT_ARGS_TEMPLATE.replace(/{model}/g, MODEL_PATH).replace(/{prompt}/g, prompt);
  // Split keeping quoted groups
  const parts = tpl.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return parts.map(s => s.replace(/^"|"$/g, ''));
}

function checkEnvironment() {
  // Check model file existence
  try {
    if (!fs.existsSync(MODEL_PATH)) {
      console.warn(`Warning: model file not found at ${MODEL_PATH}. Ensure the model path is correct.`);
    }
  } catch (e) {
    console.warn('Warning: could not access model path', e && e.message);
  }

  // Check whether the GPT_CMD is callable
  try {
    const probe = spawnSync(GPT_CMD, ['--version'], { encoding: 'utf8' });
    if (probe.error) {
      console.warn(`Warning: failed to execute "${GPT_CMD}". ${probe.error.message}`);
    } else if (probe.status !== 0) {
      // Sometimes --version returns non-zero; still print stdout/stderr for diagnostics
      console.info(`${GPT_CMD} probe exited ${probe.status}. stdout: ${probe.stdout || ''} stderr: ${probe.stderr || ''}`);
    } else {
      console.info(`${GPT_CMD} available: ${probe.stdout ? probe.stdout.toString().trim() : 'ok'}`);
    }
  } catch (e) {
    console.warn(`Warning: could not probe ${GPT_CMD}: ${e && e.message}`);
  }
}

app.post('/api/ai', async (req, res) => {
  const prompt = (req.body && req.body.prompt) ? String(req.body.prompt) : '';
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const args = buildArgs(prompt);
  try {
    const child = spawn(GPT_CMD, args, { windowsHide: true });
    let out = '';
    let err = '';
    let responded = false;

    child.stdout.on('data', d => out += d.toString());
    child.stderr.on('data', d => err += d.toString());

    child.on('error', (e) => {
      console.error('Failed to start LLM process', { cmd: GPT_CMD, args, message: e && e.message, stack: e && e.stack });
      if (responded || res.headersSent) return;
      responded = true;
      return res.status(500).json({
        error: 'failed to start LLM process',
        detail: e && e.message,
        cmd: GPT_CMD,
        args
      });
    });

    child.on('close', code => {
      if (responded || res.headersSent) return;
      responded = true;
      if (code !== 0) {
        return res.status(500).json({ error: 'LLM process exited with error', code, stderr: err });
      }
      res.json({ text: out.trim() });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Run a quick environment probe so users get diagnostics in logs
checkEnvironment();

app.listen(PORT, () => console.log(`Local AI bridge listening on http://127.0.0.1:${PORT}`));
