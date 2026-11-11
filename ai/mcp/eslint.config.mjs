// Sprawdzenie kodu serwerów MCP (ai/mcp/ i supabase/functions/): Node, Deno i wspólny rdzeń.
// Uruchomienie: eslint --no-config-lookup -c ai/mcp/eslint.config.mjs ai/mcp supabase/functions
const GLOBALNE = ['fetch', 'globalThis', 'process', 'URL', 'Request', 'Response', 'Headers', 'Deno', 'console', 'setTimeout', 'clearTimeout', 'atob', 'btoa', 'TextDecoder', 'TextEncoder'];

export default [{
  files: ['**/*.mjs', '**/*.js'],
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: Object.fromEntries(GLOBALNE.map((g) => [g, 'readonly'])) },
  rules: {
    'no-undef': 'error',
    'no-unused-vars': ['error', { args: 'none', ignoreRestSiblings: true, caughtErrors: 'none' }],
  },
}];
