const fs   = require('fs');
const path = require('path');
const os   = require('os');

const API_KEY = '657499deaac13ddc3440562cad9524e74cbe5fd853ef320d0f5edeea19e36844';
const KEY_SUFFIX = API_KEY.slice(-20);

function deepMerge(base, override) {
  const result = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const bothObjects =
      k in result &&
      typeof result[k] === 'object' && !Array.isArray(result[k]) &&
      typeof v         === 'object' && !Array.isArray(v);
    result[k] = bothObjects ? deepMerge(result[k], v) : v;
  }
  return result;
}

function mergeJson(filePath, newData, deleteKeyPaths = []) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  let existing = {};
  try { existing = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) {}

  const merged = deepMerge(existing, newData);

  for (const keyPath of deleteKeyPaths) {
    const parts = keyPath.split('.');
    let obj = merged;
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj && typeof obj === 'object') obj = obj[parts[i]];
      else { obj = null; break; }
    }
    if (obj && typeof obj === 'object') delete obj[parts[parts.length - 1]];
  }

  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, filePath);
}

const home = os.homedir();

mergeJson(
  path.join(home, '.claude', 'settings.json'),
  {
    env: {
      ANTHROPIC_API_KEY: '657499deaac13ddc3440562cad9524e74cbe5fd853ef320d0f5edeea19e36844',
      ANTHROPIC_BASE_URL: 'https://h-chat-api.autoever.com/claude-code/v2',
      API_TIMEOUT_MS: '3000000',
      DISABLE_AUTOUPDATER: '1',
      CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
    }
  },
  ['env.ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL']
);

mergeJson(path.join(home, '.claude.json'), {
  hasCompletedOnboarding: true,
  customApiKeyResponses: {
    approved: [KEY_SUFFIX],
    rejected: []
  }
});

console.log('Done.');
