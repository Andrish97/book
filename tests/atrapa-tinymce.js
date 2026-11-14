// Zaślepka TinyMCE dla testów (bez sieci): tyle API, ile używa skrzynka w panelu administratora
// (js/app/skrzynka.js) – init z target i setup, getContent (HTML i tekst), setContent, on/fire, focus, remove.
// Treść to zwykłe pole contenteditable (.atrapa-tinymce) zaraz za ukrytym <textarea>.
(() => {
  const edytory = new Map();
  window.tinymce = {
    majorVersion: '7',
    addI18n() {},
    get: (id) => edytory.get(id) || null,
    init(opcje) {
      const cel = opcje.target;
      const pole = document.createElement('div');
      pole.className = 'atrapa-tinymce';
      pole.contentEditable = 'true';
      pole.setAttribute('role', 'textbox');
      pole.setAttribute('aria-label', 'Treść wiadomości');
      pole.style.cssText = `min-height:${opcje.min_height || 200}px;padding:10px;outline:none;overflow:auto`;
      cel.style.display = 'none';
      cel.after(pole);
      const sluchacze = new Map();
      const ed = {
        id: cel.id,
        opcje,
        getContent: ({ format } = {}) => (format === 'text' ? pole.innerText.trim() : pole.innerHTML),
        setContent: (html) => { pole.innerHTML = html; },
        insertContent: (html) => { pole.insertAdjacentHTML('beforeend', html); },
        getBody: () => pole,
        focus: () => pole.focus(),
        on(nazwy, fn) { for (const n of nazwy.split(/\s+/)) sluchacze.set(n, [...(sluchacze.get(n) || []), fn]); },
        fire(n, e = {}) { for (const fn of sluchacze.get(n) || []) fn(e); },
        remove() { pole.remove(); cel.style.display = ''; edytory.delete(cel.id); },
      };
      pole.addEventListener('input', () => ed.fire('input'));
      edytory.set(cel.id, ed);
      opcje.setup?.(ed);
      ed.fire('init');
      opcje.init_instance_callback?.(ed);
      return Promise.resolve([ed]);
    },
  };
})();
