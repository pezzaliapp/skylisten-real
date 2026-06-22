// Configurazione ESLint (flat config, ESLint 9+). OPZIONALE: serve solo allo
// sviluppo, non è richiesta per usare la PWA (che resta file statici).

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  localStorage: 'readonly',
  fetch: 'readonly',
  WebSocket: 'readonly',
  AudioContext: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  Blob: 'readonly',
  URL: 'readonly',
  alert: 'readonly',
  console: 'readonly',
};

const workerGlobals = {
  self: 'readonly',
  caches: 'readonly',
  fetch: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
  URL: 'readonly',
  clients: 'readonly',
};

const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  setTimeout: 'readonly',
};

export default [
  {
    files: ['app.js', 'js/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: browserGlobals },
    rules: { 'no-unused-vars': 'warn', 'no-undef': 'error' },
  },
  {
    files: ['sw.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: workerGlobals },
    rules: { 'no-unused-vars': 'warn', 'no-undef': 'error' },
  },
  {
    files: ['server/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: nodeGlobals },
    rules: { 'no-unused-vars': 'warn', 'no-undef': 'error' },
  },
];
