// Sprawdzenie kodu aplikacji: przede wszystkim nazwy użyte bez definicji –
// po podziale na moduły łatwo zapomnieć o imporcie w rzadko używanej funkcji.
const PRZEGLADARKA = [
  'window', 'document', 'navigator', 'location', 'history', 'localStorage', 'sessionStorage', 'indexedDB', 'IDBRequest',
  'fetch', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'Image', 'Event', 'CustomEvent', 'EventTarget',
  'crypto', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'ResizeObserver', 'MutationObserver', 'IntersectionObserver', 'structuredClone', 'TextDecoder', 'TextEncoder', 'Option', 'matchMedia',
  'getComputedStyle', 'performance', 'caches', 'self', 'HTMLElement', 'Element', 'DOMParser', 'XMLSerializer', 'AbortController', 'launchQueue', 'btoa', 'atob',
  'fabric', 'CSS',
];

export default [
  { ignores: ['js/zewnetrzne/**'] },
  {
    files: ['js/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: Object.fromEntries(PRZEGLADARKA.map((g) => [g, 'readonly'])) },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', ignoreRestSiblings: true, caughtErrors: 'none' }],
    },
  },
];
