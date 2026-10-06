// One True Shell reference behavior: keyboard shortcuts, palette, tabs, optimistic writes.
(function () {
  'use strict';

  const SCHEMA = JSON.parse(document.getElementById('shell-schema').textContent);
  const ENTITIES = SCHEMA.entities;
  const CSRF = document.querySelector('meta[name="csrf-token"]').content;
  const body = document.body;
  const entity = body.dataset.entity || null;
  const recordKey = body.dataset.record || null;
  let activeKey = recordKey; // the record being shown, or the one we are navigating to

  // Keys pressed while a page load is in flight are carried over and replayed on the next page,
  // so a fast "Escape j Enter" behaves the same as a slow one.
  const KEYS_KEY = 'ots:keys';
  let navigating = false;
  function go(url) {
    navigating = true;
    location.href = url;
  }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const shell = (name) => $(`[data-shell="${name}"]`);

  const store = {
    get(area, key, fallback) {
      try { const v = window[area].getItem(key); return v === null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(area, key, value) {
      try { window[area].setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    },
    remove(area, key) {
      try { window[area].removeItem(key); } catch { /* storage unavailable */ }
    },
  };

  function status(msg, isError) {
    const el = $('[data-status]');
    el.textContent = msg;
    el.classList.toggle('is-error', !!isError);
  }

  async function post(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = json.errors ? Object.entries(json.errors).map(([k, v]) => `${k}: ${v}`).join(', ') : json.error;
      throw new Error(detail || `HTTP ${res.status}`);
    }
    return json;
  }

  // ---- tabs (section 4) -------------------------------------------------
  const TABS_KEY = 'ots:tabs';
  let openTabs = store.get('localStorage', TABS_KEY, []);
  const saveTabs = () => store.set('localStorage', TABS_KEY, openTabs);

  function upsertTab(key, title) {
    const existing = openTabs.find((t) => t.key === key);
    if (existing) existing.title = title;
    else openTabs.push({ key, title });
    saveTabs();
  }

  function renderTabs() {
    const bar = shell('tabs');
    bar.replaceChildren(...openTabs.map((t) => {
      const el = document.createElement('div');
      el.className = 'tab';
      el.setAttribute('role', 'tab');
      el.dataset.shellTab = '';
      el.dataset.id = t.key;
      el.setAttribute('aria-selected', String(t.key === activeKey));
      const label = document.createElement('a');
      label.className = 'tab-label';
      label.href = '/' + t.key;
      label.textContent = t.title;
      label.tabIndex = -1;
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'tab-close';
      close.dataset.shellTabClose = '';
      close.setAttribute('aria-label', `Close ${t.title}`);
      close.textContent = '×';
      el.append(label, close);
      return el;
    }));
  }

  function closeTab(key) {
    const idx = openTabs.findIndex((t) => t.key === key);
    if (idx === -1) return;
    openTabs.splice(idx, 1);
    saveTabs();
    if (key === activeKey) {
      const next = openTabs[idx] || openTabs[idx - 1];
      activeKey = next ? next.key : null;
      renderTabs();
      go(next ? '/' + next.key : '/' + key.split('/')[0]);
    } else {
      renderTabs();
    }
  }

  shell('tabs').addEventListener('click', (e) => {
    const tabEl = e.target.closest('[data-shell-tab]');
    if (!tabEl) return;
    e.preventDefault();
    if (e.target.closest('[data-shell-tab-close]')) closeTab(tabEl.dataset.id);
    else if (tabEl.dataset.id !== activeKey) openRecord(tabEl.dataset.id);
  });

  // ---- list selection (B04, B05) -----------------------------------------
  const RETURN_KEY = 'ots:return';
  const list = $('[data-shell-list]');
  const rows = () => $$('[data-shell-row]', list || document);

  function select(row) {
    if (!row) return;
    rows().forEach((r) => r.setAttribute('aria-selected', String(r === row)));
    row.scrollIntoView({ block: 'nearest' });
  }
  const selected = () => $('[data-shell-row][aria-selected="true"]');

  function move(delta) {
    const all = rows();
    if (!all.length) return;
    const i = all.indexOf(selected());
    select(all[Math.min(all.length - 1, Math.max(0, i + delta))]);
  }

  // Opening a record activates its tab right away, before the page load finishes.
  function openRecord(key, title) {
    if (title) upsertTab(key, title);
    activeKey = key;
    renderTabs();
    go('/' + key);
  }

  function openSelected() {
    const row = selected();
    if (row && entity) openRecord(`${entity}/${row.dataset.id}`, $('.row-title', row).textContent);
  }

  if (list) {
    const back = store.get('sessionStorage', RETURN_KEY, null);
    store.remove('sessionStorage', RETURN_KEY);
    const target = back && back.startsWith(entity + '/') ? $(`[data-shell-row][data-id="${CSS.escape(back.split('/')[1])}"]`, list) : null;
    select(target || rows()[0]);
    list.addEventListener('click', (e) => {
      const row = e.target.closest('[data-shell-row]');
      if (!row) return;
      e.preventDefault();
      select(row);
      openSelected();
    });
  }

  // ---- record view: optimistic edit (B12) ---------------------------------
  if (recordKey) {
    upsertTab(recordKey, body.dataset.recordTitle);
    const ent = ENTITIES[entity];
    const rid = recordKey.split('/')[1];
    const h1 = $('[data-record-h1]');

    async function saveField(control) {
      const name = control.name;
      const value = control.value.trim();
      const previous = control.dataset.saved;
      if (value === previous) return;
      const isTitle = name === ent.title_field;
      // Optimistic: reflect the change everywhere before the server answers.
      control.dataset.saved = value;
      if (isTitle) {
        h1.textContent = value;
        document.title = `${value} · ${ent.label}`;
        upsertTab(recordKey, value);
        renderTabs();
      }
      status('Saving…');
      try {
        await post(`/api/${entity}/${rid}`, { [name]: value });
        status('Saved');
      } catch (err) {
        control.dataset.saved = previous;
        control.value = previous;
        if (isTitle) {
          h1.textContent = previous;
          upsertTab(recordKey, previous);
          renderTabs();
        }
        status(`Not saved: ${err.message}`, true);
      }
    }

    $$('[data-shell-field] input').forEach((input) => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveField(input); }
      });
      input.addEventListener('blur', () => saveField(input));
    });
    $$('[data-shell-field] select').forEach((sel) => sel.addEventListener('change', () => saveField(sel)));
  }
  renderTabs();

  // ---- overlays ---------------------------------------------------------
  const palette = shell('palette');
  const paletteInput = $('[data-shell-palette-input]');
  const paletteList = $('[data-palette-list]');
  const sheet = shell('shortcuts');
  const createOverlay = $('[data-create-overlay]');
  const createForm = shell('create');
  let returnFocus = null;

  const isOpen = (el) => !el.hidden;
  const anyOverlay = () => [palette, sheet, createOverlay].some(isOpen);

  function openOverlay(el) {
    closeOverlays();
    returnFocus = document.activeElement;
    el.hidden = false;
  }
  function closeOverlays() {
    palette.hidden = true;
    sheet.hidden = true;
    createOverlay.hidden = true;
    createForm.hidden = true;
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
  }
  [palette, sheet, createOverlay].forEach((el) => el.addEventListener('mousedown', (e) => {
    if (e.target === el) closeOverlays();
  }));

  // ---- palette (B01, B02) ------------------------------------------------
  const commands = Object.values(ENTITIES).flatMap((e) => [
    { label: e.plural, hint: 'Go to', run: () => go('/' + e.key) },
    { label: `Create ${e.label}`, hint: 'Action', run: () => openCreate(e.key) },
  ]);
  let matches = [];
  let active = 0;

  function renderPalette() {
    const q = paletteInput.value.trim().toLowerCase();
    matches = commands.filter((c) => c.label.toLowerCase().includes(q));
    active = Math.min(active, Math.max(0, matches.length - 1));
    paletteList.replaceChildren(...matches.map((c, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === active));
      li.innerHTML = '<span></span><span class="hint"></span>';
      li.firstChild.textContent = c.label;
      li.lastChild.textContent = c.hint;
      li.addEventListener('mousedown', (e) => { e.preventDefault(); runCommand(c); });
      return li;
    }));
    if (!matches.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No matching commands';
      paletteList.append(li);
    }
  }

  function runCommand(c) {
    closeOverlays();
    c.run();
  }

  function openPalette() {
    openOverlay(palette);
    paletteInput.value = '';
    active = 0;
    renderPalette();
    paletteInput.focus();
  }

  paletteInput.addEventListener('input', () => { active = 0; renderPalette(); });
  paletteInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, matches.length - 1); renderPalette(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); renderPalette(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (matches[active]) runCommand(matches[active]); }
  });

  // ---- create form: optimistic create (B11) ------------------------------
  function fieldControl(name, field) {
    let control;
    if (field.type === 'enum' || field.type === 'ref') {
      control = document.createElement('select');
      const opts = field.type === 'enum'
        ? field.values.map((v) => ({ id: v, title: v }))
        : [{ id: '', title: '(none)' }, ...(SCHEMA.refs[field.to] || [])];
      opts.forEach((o) => control.append(new Option(o.title, o.id)));
    } else {
      control = document.createElement('input');
      control.type = 'text';
      control.autocomplete = 'off';
      if (field.required) control.required = true;
    }
    control.name = name;
    return control;
  }

  function openCreate(key) {
    const ent = ENTITIES[key];
    createForm.replaceChildren();
    createForm.dataset.entity = key;
    const h = document.createElement('h2');
    h.textContent = `New ${ent.label}`;
    createForm.append(h);
    for (const [name, field] of Object.entries(ent.fields)) {
      const label = document.createElement('label');
      label.className = 'field';
      const span = document.createElement('span');
      span.className = 'field-label';
      span.textContent = name + (field.required ? ' *' : '');
      label.append(span, fieldControl(name, field));
      createForm.append(label);
    }
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn';
    submit.textContent = `Create ${ent.label}`;
    createForm.append(submit);
    openOverlay(createOverlay);
    createForm.hidden = false;
    createForm.querySelector('input, select').focus();
  }

  function optimisticRow(key, id, title) {
    if (!list || key !== entity) return null;
    const li = document.createElement('li');
    li.className = 'row is-pending';
    li.setAttribute('role', 'option');
    li.dataset.shellRow = '';
    li.dataset.id = id;
    const a = document.createElement('a');
    a.className = 'row-title';
    a.href = `/${key}/${id}`;
    a.tabIndex = -1;
    a.textContent = title;
    li.append(a);
    list.append(li);
    select(li);
    return li;
  }

  function optimisticRecord(ent, title) {
    const main = shell('main');
    const previous = Array.from(main.childNodes);
    const h1 = document.createElement('h1');
    h1.textContent = title;
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = `New ${ent.label} · saving…`;
    main.replaceChildren(h1, p);
    return () => main.replaceChildren(...previous);
  }

  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = createForm.dataset.entity;
    const ent = ENTITIES[key];
    const data = Object.fromEntries(new FormData(createForm));
    const title = (data[ent.title_field] || '').trim();
    if (!title) { status(`${ent.title_field} is required`, true); return; }
    const id = key[0] + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    closeOverlays();
    // Optimistic: show the record before the server answers.
    const row = optimisticRow(key, id, title);
    const undo = row ? () => row.remove() : optimisticRecord(ent, title);
    status('Saving…');
    try {
      await post(`/api/${key}`, { id, ...data });
      if (row) row.classList.remove('is-pending');
      status(`Created ${title}`);
      upsertTab(`${key}/${id}`, title);
      openRecord(`${key}/${id}`);
    } catch (err) {
      undo();
      if (row && list) select(rows()[0]);
      status(`Not created: ${err.message}`, true);
    }
  });

  // ---- global keys ------------------------------------------------------
  function isTyping(el) {
    return el instanceof HTMLElement && (el.isContentEditable || el.matches('input, textarea, select'));
  }

  function handleKey(e) {
    if (navigating) {
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault();
        const queued = store.get('sessionStorage', KEYS_KEY, []);
        queued.push(e.key);
        store.set('sessionStorage', KEYS_KEY, queued);
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (isOpen(palette)) closeOverlays(); else openPalette();
      return;
    }
    if (e.key === 'Escape') {
      if (anyOverlay()) { e.preventDefault(); closeOverlays(); return; }
      if (recordKey) {
        e.preventDefault();
        store.set('sessionStorage', RETURN_KEY, recordKey);
        activeKey = null;
        renderTabs();
        go('/' + entity);
      }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || anyOverlay()) return;

    switch (e.key) {
      case 'j': move(1); break;
      case 'k': move(-1); break;
      case 'Enter': if (list) { e.preventDefault(); openSelected(); } break;
      case '?': openOverlay(sheet); break;
      case '[': shell('sidebar').hidden = !shell('sidebar').hidden; body.classList.toggle('no-sidebar'); break;
      default: return;
    }
  }

  document.addEventListener('keydown', handleKey);

  // Replay keys typed before this script ran (head bootstrap) or during the previous page's load.
  const early = window.__otsEarlyKeys || [];
  document.removeEventListener('keydown', window.__otsEarlyListener, true);
  const carried = store.get('sessionStorage', KEYS_KEY, []);
  store.remove('sessionStorage', KEYS_KEY);
  for (const key of [...carried, ...early]) {
    handleKey({ key, ctrlKey: false, metaKey: false, altKey: false, target: document.body, preventDefault() {} });
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'palette') openPalette();
    else if (action === 'shortcuts') openOverlay(sheet);
    else if (action === 'create' && entity) openCreate(entity);
  });
})();
