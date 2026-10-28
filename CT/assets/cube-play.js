/* Keyboard cube playground. The app supplies its renderer and shared controls;
   the engine remains the only authority for moves and sticker coordinates. */
(() => {
  const C = window.CT;
  const ROWS = [
    [['Backquote','`'], ...'1234567890'.split('').map(n => ['Digit'+n,n]), ['Minus','−'], ['Equal','=']],
    [...'QWERTYUIOP'.split('').map(n => ['Key'+n,n]), ['BracketLeft','['], ['BracketRight',']'], ['Backslash','\\']],
    [...'ASDFGHJKL'.split('').map(n => ['Key'+n,n]), ['Semicolon',';'], ['Quote',"'"]],
    [['ShiftLeft','L Shift'], ...'ZXCVBNM'.split('').map(n => ['Key'+n,n]), ['Comma',','], ['Period','.'], ['Slash','/'], ['ShiftRight','R Shift']],
    [['ControlLeft','L Ctrl'], ['AltLeft','L Alt'], ['Space','Space'], ['AltRight','R Alt'], ['ControlRight','R Ctrl']],
  ];
  const KEYS = new Map(ROWS.flat());
  const MODIFIER_KEYS = new Set(['ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight']);
  // Digit keys are reserved for the page's own buttons, so they can never be remapped.
  const SHORTCUTS = { Digit1: {action:'scramble', label:'Scr', name:'Scramble'}, Digit2: {action:'reset', label:'Rst', name:'Reset'} };
  const BASES = ['U','R','F','D','L','B','M','E','S','Rw','Lw','Uw','Dw','Fw','Bw','x','y','z'];
  const ACTIONS = BASES.flatMap(m => [m, m+"'", m+'2']);
  const DEFAULT_KEYS = { KeyE:'B', KeyO:"B'", KeyS:'U', KeyD:"L'", KeyF:"F'", KeyK:'F', KeyL:'R', Semicolon:"U'", KeyC:'L', KeyV:"D'", KeyM:'D', Comma:"R'", ShiftLeft:"x'", ShiftRight:'x', AltLeft:"y'", AltRight:'y', Space:"M'" };
  function defaults(saved = {}) {
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
    const number = (key, fallback, min, max) => Number.isFinite(saved[key]) ? Math.max(min, Math.min(max, saved[key])) : fallback;
    const bindings = Object.hasOwn(saved, 'bindings') && saved.bindings && typeof saved.bindings === 'object' ? saved.bindings : DEFAULT_KEYS;
    return { separation: number('separation',15,0,100), pitch: number('pitch',-38,-85,85), yaw: number('yaw',0,-180,180), radius: number('radius',3,0,22), outlineThickness: number('outlineThickness',.5,.5,10), zoom: number('zoom',1,.45,1.8), perspective: number('perspective',96,0,100), outlines: saved.outlines !== false, useAppCube: saved.useAppCube === true, explodeAppCube: saved.explodeAppCube === true, animations: saved.animations !== false,
      bindings: Object.fromEntries(Object.entries(bindings).filter(([key, action]) => KEYS.has(key) && !SHORTCUTS[key] && ACTIONS.includes(action))) };
  }
  function page(icon, options = {}) {
    const name = String(options.name || 'Cube playground').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return `<section class="cube-play"><header class="cube-play-head"><h1>${name}</h1>${options.categorySelect || ''}${options.virtual ? '<output class="virtual-time" data-virtual-time role="timer" aria-label="Virtual solve time">0.00</output>' : ''}<div><button class="btn btn-quiet" data-play="scramble" title="Scramble (1)" aria-keyshortcuts="1">${icon('shuffle')}Scramble</button><button class="btn btn-quiet" data-play="reset" title="Reset (2)" aria-keyshortcuts="2">${icon('reset')}Reset</button><button class="icon-btn tool-btn" data-play="settings" aria-label="Cube playground settings" title="Settings">${icon('settings')}</button></div></header>${options.virtual ? '<p class="virtual-scramble" data-play-scramble data-copyable></p>' : ''}<div class="cube-play-mount" id="cube-play-mount"></div><span class="sr-only" data-play-status role="status" aria-live="polite">Solved</span></section>`;
  }
  function create(host, ctx) {
    let scene, preview, previewResize, clockFrame = 0, settings = defaults(ctx.settings()), disposed = false, queue = [], generation = 0, settingsAbort, picker;
    const cube = ctx.cube, pendingModifiers = new Map();
    const eligibleTarget = target => !target?.closest?.('input,textarea,select,button,a,[contenteditable],[role="button"],[role="slider"]');
    const enqueue = action => {
      if (ctx.session) {
        const outcome = ctx.session.accept(action, performance.now());
        if (!outcome.accepted) return;
        // Record against the authoritative input state before awaiting any
        // visual frames. Queued turns cannot delay or lose the final move.
        if (outcome.result) ctx.completed(outcome.result);
        updateClock();
      }
      queue.push(action); if (queue.length === 1) drain();
    };
    function updateClock() {
      cancelAnimationFrame(clockFrame);
      if (disposed || !ctx.session) return;
      const label = host.querySelector('[data-virtual-time]');
      if (label) label.textContent = ctx.session.phase === 'running' && ctx.hideTime?.() ? '···' : C.format(ctx.session.time(performance.now()) / 1000);
      if (ctx.session.phase === 'running') clockFrame = requestAnimationFrame(updateClock);
      status();
    }
    const onKey = e => {
      if (!e.repeat) for (const [code] of pendingModifiers) if (code !== e.code) pendingModifiers.set(code, false);
      if (disposed || document.querySelector('dialog[open]') || e.defaultPrevented || e.repeat || e.isComposing || !eligibleTarget(e.target)) return;
      if (MODIFIER_KEYS.has(e.code)) {
        if (!settings.bindings[e.code] || pendingModifiers.has(e.code)) return;
        const hasOtherModifier = e.metaKey || (e.ctrlKey && !e.code.startsWith('Control')) || (e.altKey && !e.code.startsWith('Alt')) || (e.shiftKey && !e.code.startsWith('Shift'));
        pendingModifiers.set(e.code, !hasOtherModifier);
        if (!hasOtherModifier) e.preventDefault();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const shortcut = SHORTCUTS[e.code];
      if (shortcut) { e.preventDefault(); reset(shortcut.action === 'scramble'); return; }
      const action = settings.bindings[e.code];
      if (!action) return;
      e.preventDefault();
      enqueue(action);
    };
    // A modifier on its own is a move on release; a shortcut or chord cancels it.
    const onKeyUp = e => {
      if (!pendingModifiers.has(e.code)) return;
      const alone = pendingModifiers.get(e.code);
      pendingModifiers.delete(e.code);
      if (!alone || disposed || document.querySelector('dialog[open]') || e.defaultPrevented || e.isComposing || !eligibleTarget(e.target)) return;
      const action = settings.bindings[e.code];
      if (action) { e.preventDefault(); enqueue(action); }
    };
    const clearModifiers = () => pendingModifiers.clear();
    async function drain() {
      const request = generation;
      while (queue.length && !disposed && request === generation) {
        const action = queue[0];
        scene.moves = [action]; scene.index = 0;
        scene.moveDuration = settings.animations ? ctx.speed() : 0;
        const renderer = scene.realistic;
        renderer?.setAnimationActive(settings.animations);
        await scene.step(1);
        renderer?.setAnimationActive(false);
        if (request !== generation || disposed) return;
        queue.shift(); status(action);
      }
    }
    function status(action = '') {
      const faces = cube.facelets();
      const solved = Object.values(faces).every(face => face.every(c => c === face[0]));
      const label = host.querySelector('[data-play-status]');
      const phase = ctx.session?.phase;
      (host.closest?.('.cube-play') || host.querySelector('.cube-play'))?.setAttribute('data-phase', phase || '');
      if (label && action) label.dataset.lastMove = action;
      if (label) label.textContent = phase
        ? {idle:'Scramble to start',inspection:'Inspection · First turn starts',running:'Solving',complete:'Saved'}[phase]
        : [action, solved ? 'Solved' : 'Keep going'].filter(Boolean).join(' · ');
      const scramble = host.querySelector('[data-play-scramble]');
      if (scramble) scramble.textContent = ctx.session.scramble;
    }
    function applyView() {
      for (const target of [scene, preview].filter(Boolean)) {
        target.pitch = settings.pitch; target.yaw = settings.yaw;
        const stage = target.stage, size = Math.min(stage.clientWidth, stage.clientHeight);
        if (!size) continue;
        const exploded = !settings.useAppCube || settings.explodeAppCube;
        target.zoom = size / (exploded ? 600 : 330) * settings.zoom;
        const perspective = size * Math.exp(Math.log(30) + Math.log(1.2 / 30) * settings.perspective / 100);
        target.projection = { perspective, pixelScale: target.zoom * 46 };
        stage.style.perspective = perspective+'px';
        stage.classList.toggle('cube-exploded', !settings.useAppCube);
        stage.classList.toggle('cube-surfaces-separated', settings.useAppCube && settings.explodeAppCube);
        stage.classList.toggle('no-sticker-outlines', !settings.outlines);
        stage.style.setProperty('--play-radius', settings.radius+'px');
        stage.style.setProperty('--play-outline-thickness', settings.outlineThickness+'px');
        stage.dataset.zoom = settings.zoom;
        stage.dataset.perspective = settings.perspective;
        target.orbit(); target.draw();
      }
    }
    function buildScene(mount) {
      const target = ctx.scene(mount, settings);
      target.cube = cube;
      target.stage.setAttribute('role','group');
      target.stage.setAttribute('aria-label', mount.id === 'cube-play-preview' ? 'Live cube preview. Scroll to zoom.' : 'Keyboard-controlled cube. Scroll to zoom; open settings to map keys.');
      return target;
    }
    function rebuild() {
      generation++; queue = [];
      if (ctx.session) cube.stickers = structuredClone(ctx.session.cube.stickers);
      scene?.destroy();
      preview?.destroy();
      scene = buildScene(host.querySelector('#cube-play-mount'));
      const mount = document.querySelector('#cube-play-preview');
      preview = settingsAbort && mount ? buildScene(mount) : null;
      scene.onDraw = (spec, fraction) => preview?.draw(spec, fraction);
      applyView(); status(); updateClock();
    }
    function wheel(e) {
      clearModifiers();
      if (e.ctrlKey || !e.target.closest('.cube-stage')) return;
      e.preventDefault();
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      settings.zoom = Math.round(Math.max(.45, Math.min(1.8, settings.zoom * Math.exp(-delta * .0015))) * 1000) / 1000;
      save(); applyView();
    }
    function save() { ctx.save(settings); }
    function reset(scramble = false) {
      // Cancel a partial visual turn before changing the authoritative state.
      // The cube is always set down the way the chosen cross colour is held: scramble first, then turn it.
      const orientation = ctx.orientation?.() || '';
      if (ctx.session) ctx.session.prepare(scramble ? C.scramble() : '', orientation);
      else {
        cube.stickers = new C.Cube().stickers;
        if (scramble) cube.apply(C.scramble());
        cube.apply(orientation);
      }
      rebuild(); status(scramble ? 'Scrambled' : '');
      scene.stage.focus({ preventScroll: true });
    }
    const slider = (key, label, min, max, value, suffix = '', disabled = false, step = 1) => `<label class="play-setting"><span>${label}<output data-play-value="${key}">${value}${suffix}</output></span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-play-setting="${key}" aria-label="${label}"${disabled ? ' disabled' : ''}></label>`;
    function keyboard() {
      return `<div class="play-keyboard" role="group" aria-label="Keyboard move assignments">${ROWS.map((row,i) => `<div class="play-key-row play-key-row-${i}">${row.map(([code,key]) => SHORTCUTS[code] ? `<button type="button" class="play-key" disabled title="Reserved: ${SHORTCUTS[code].name}" aria-label="Key ${ctx.esc(key)}: reserved for ${SHORTCUTS[code].name}"><span>${ctx.esc(key)}</span><b>${SHORTCUTS[code].label}</b></button>` : `<button type="button" class="play-key" data-game-key="${code}" aria-haspopup="dialog" aria-expanded="false" aria-label="Key ${ctx.esc(key)}: ${ctx.esc(settings.bindings[code] || 'Unassigned')}"><span>${ctx.esc(key)}</span><b>${ctx.esc(settings.bindings[code] || '·')}</b></button>`).join('')}</div>`).join('')}</div>`;
    }
    function openPicker(anchor) {
      picker?.destroy();
      const code = anchor.dataset.gameKey, current = settings.bindings[code];
      const panel = document.createElement('div');
      panel.className = 'play-action-picker'; panel.hidden = true;
      panel.setAttribute('role','dialog'); panel.setAttribute('aria-label',`Assign ${KEYS.get(code)}`);
      panel.innerHTML = `<div class="play-picker-head"><strong>${ctx.esc(KEYS.get(code))}</strong><button class="btn-link" data-assign="">Clear</button></div>${[['Face turns',BASES.slice(0,6)],['Slices',BASES.slice(6,9)],['Wide turns',BASES.slice(9,15)],['Cube rotations',BASES.slice(15)]].map(([label,bases]) => `<div class="play-action-group"><h4>${label}</h4><div>${bases.flatMap(base => [base,base+"'",base+'2']).map(action => `<button class="${action === current ? 'active' : ''}" data-assign="${ctx.esc(action)}" aria-pressed="${action === current}">${ctx.esc(action)}</button>`).join('')}</div></div>`).join('')}`;
      panel.addEventListener('click', e => {
        const button = e.target.closest('[data-assign]');
        if (!button) return;
        const action = button.dataset.assign;
        if (action) settings.bindings[code] = action; else delete settings.bindings[code];
        save(); anchor.querySelector('b').textContent = action || '·';
        anchor.setAttribute('aria-label',`Key ${KEYS.get(code)}: ${action || 'Unassigned'}`);
        picker.close(true);
      });
      panel.addEventListener('keydown', e => {
        const buttons = [...panel.querySelectorAll('[data-assign]')], index = buttons.indexOf(document.activeElement);
        const delta = {ArrowRight:1,ArrowLeft:-1,ArrowDown:6,ArrowUp:-6}[e.key];
        if (delta || e.key === 'Home' || e.key === 'End') {
          e.preventDefault();
          buttons[e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length-1 : Math.max(0,Math.min(buttons.length-1,index+delta))].focus();
        }
      });
      picker = FloatingPopover.create({ anchor, panel, floating:true, restoreFocus:true,
        onOpen() { (panel.querySelector('.active') || panel.querySelector('[data-assign]')).focus({preventScroll:true}); } });
      picker.toggle(true);
    }
    function openSettings() {
      closeSettings();
      const appearance = ctx.group('Display',
        ctx.toggle('play-useAppCube',settings.useAppCube,'Use app cube','Use the model selected in Appearance.') +
        `<div data-app-explosion${settings.useAppCube ? '' : ' hidden'}>${ctx.toggle('play-explodeAppCube',settings.explodeAppCube,'Explode app cube')}</div>` +
        `<div data-separation${!settings.useAppCube || settings.explodeAppCube ? '' : ' hidden'}>${slider('separation','Sticker separation',0,100,settings.separation)}</div>`+
        `<fieldset class="play-css-settings"${settings.useAppCube ? ' disabled' : ''}>${ctx.toggle('play-outlines',settings.outlines,'Sticker outlines')}${slider('outlineThickness','Outline thickness',.5,10,settings.outlineThickness,'px',!settings.outlines,.5)}${slider('radius','Sticker corners',0,22,settings.radius)}</fieldset>`);
      const view = ctx.group('View angle',slider('pitch','Pitch',-85,85,settings.pitch,'°')+slider('yaw','Yaw',-180,180,settings.yaw,'°')+slider('perspective','Perspective strength',0,100,settings.perspective));
      const animation = ctx.group('Motion',ctx.toggle('play-animations',settings.animations,'Show animations')+`<div data-play-speed${settings.animations ? '' : ' hidden'}><label class="case-speed"><span>Speed</span><input type="range" min="20" max="240" step="10" value="${300-ctx.speed()}" data-play-setting="speed" aria-label="Move speed"></label></div>`);
      ctx.dialog('Cube playground',`<div class="play-settings-layout"><div class="settings-scroll scroll-fade">${appearance}${view}${animation}${ctx.group('Keyboard',keyboard()+'<button class="btn-link play-default-keys" data-play-defaults>Restore default keys</button>')}</div><section class="play-preview-pane" aria-label="Live preview"><div id="cube-play-preview"></div><span>Scroll over the cube to zoom</span></section></div><div class="dialog-actions"><button class="btn btn-dark" data-action="close-dialog">Done</button></div>`,'settings-dialog play-settings');
      const dialog = document.querySelector('#dialog');
      settingsAbort = new AbortController();
      const options = {signal:settingsAbort.signal};
      const mount = dialog.querySelector('#cube-play-preview');
      preview = buildScene(mount);
      mount.addEventListener('wheel',wheel,{...options,passive:false});
      previewResize = new ResizeObserver(applyView); previewResize.observe(mount);
      applyView();
      dialog.addEventListener('input', e => {
        const key = e.target.dataset.playSetting;
        if (!key) return;
        const value = Number(e.target.value);
        if (key === 'speed') ctx.setSpeed(300-value);
        else {
          settings[key] = value; save(); applyView();
          dialog.querySelector(`[data-play-value="${key}"]`).textContent = value+(['pitch','yaw'].includes(key) ? '°' : key === 'outlineThickness' ? 'px' : '');
        }
      },options);
      dialog.addEventListener('change', e => {
        const control = e.target.dataset.control;
        if (!control?.startsWith('play-')) return;
        e.stopImmediatePropagation();
        const key = control.slice(5); settings[key] = e.target.checked; save();
        if (key === 'useAppCube' || key === 'explodeAppCube') {
          dialog.querySelector('[data-app-explosion]').hidden = !settings.useAppCube;
          dialog.querySelector('[data-separation]').hidden = settings.useAppCube && !settings.explodeAppCube;
          dialog.querySelector('.play-css-settings').disabled = settings.useAppCube;
          if (key === 'useAppCube') rebuild();
        }
        if (key === 'animations') dialog.querySelector('[data-play-speed]').hidden = !settings.animations;
        if (key === 'outlines') dialog.querySelector('[data-play-setting="outlineThickness"]').disabled = !settings.outlines;
        applyView();
      },{...options,capture:true});
      dialog.addEventListener('click', e => {
        const key = e.target.closest('[data-game-key]');
        if (key) openPicker(key);
        if (e.target.closest('[data-play-defaults]')) {
          picker?.destroy(); settings.bindings = {...DEFAULT_KEYS}; save();
          dialog.querySelector('.play-keyboard').outerHTML = keyboard();
        }
      },options);
      dialog.addEventListener('close', () => {
        // close events are queued; a quick reopen must not tear down the new
        // settings listeners when the previous close event finally arrives.
        if (dialog.open) return;
        closeSettings();
        if (!disposed) scene.stage.focus({preventScroll:true});
      },options);
    }
    function closeSettings() {
      picker?.destroy(); picker = null; settingsAbort?.abort(); settingsAbort = null;
      previewResize?.disconnect(); previewResize = null;
      preview?.destroy(); preview = null; ctx.release('cube-play-preview');
    }
    const click = e => {
      const action = e.target.closest('[data-play]')?.dataset.play;
      if (action === 'scramble') reset(true);
      else if (action === 'reset') reset();
      else if (action === 'settings') openSettings();
    };
    host.addEventListener('click',click);
    host.addEventListener('wheel',wheel,{passive:false});
    document.addEventListener('keydown',onKey);
    document.addEventListener('keyup',onKeyUp);
    document.addEventListener('pointerdown',clearModifiers);
    window.addEventListener('blur',clearModifiers);
    const resize = new ResizeObserver(() => applyView()); resize.observe(host);
    rebuild();
    requestAnimationFrame(() => { if (!disposed && !document.querySelector('dialog[open]')) scene.stage.focus({preventScroll:true}); });
    return { refresh:rebuild, closeSettings, destroy() { disposed = true; generation++; queue=[]; cancelAnimationFrame(clockFrame); clearModifiers(); closeSettings(); resize.disconnect(); document.removeEventListener('keydown',onKey); document.removeEventListener('keyup',onKeyUp); document.removeEventListener('pointerdown',clearModifiers); window.removeEventListener('blur',clearModifiers); host.removeEventListener('click',click); host.removeEventListener('wheel',wheel); scene.destroy(); ctx.release(); } };
  }
  window.CTCubePlay = { defaults, page, create, ROWS, ACTIONS };
})();
