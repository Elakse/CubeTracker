/* Solve library: search, filters and the list, as one self-contained component (window.CTLibrary).

   Two halves, so the logic can be tested without a browser:

   MODEL  (pure functions, no DOM)
     defaultState(over)            the filter / sort / grouping state the screen keeps
     select(solves, state, ctx)    the solves that match, in display order
     rangeBounds(state, now)       [from, to] as YYYY-MM-DD for the chosen date range ("" = open)
     dayLabel(iso, now)            "Today", "Yesterday", "Saturday, Oct 24"
     monthGrid(year, month)        the cells of one calendar month, Monday first
     searchText(solve, ctx)        what the search box looks through

   VIEW   create(host, ctx) -> { refresh(), update(), destroy(), results() }
     host   the element to fill
     ctx    everything the component needs from the app, so it knows nothing about it:
              state                shared state object (defaultState()), kept by the app between visits
              solves()             all solves, oldest first
              value(s), format(v)  seconds (Infinity for DNF) and its text
              average(list, n)     trimmed average of a list
              dateOf(s)            Date or null
              stats()              { count, best, mean, dnf } for the summary line
              esc(text), icon(name), badges(s)
              open(id)             show the solve dialog
              setPenalty(id, p)    "", "+2" or "DNF"
              remove(id)           ask to delete (the app confirms and offers undo)
              copy(text)           copy the scramble
              persist()            called when a setting worth remembering changed (T, grouping)
              now()                optional, for tests
   One class per concern is not worth it here: the view is a handful of small closures over one state object. */
(function (root) {
  "use strict";

  /* ------------------------------------------------------------------ model */
  const DAY = 864e5;
  const pad = (n) => String(n).padStart(2, "0");
  const isoDay = (d) => {
    d = d instanceof Date ? d : new Date(d);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const parseISO = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const RANGES = [["any", "Any time"], ["today", "Today"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["month", "This month"]];
  const T_MIN = 0.5, T_MAX = 3600;

  function defaultState(over = {}) {
    return { q: "", filter: "all", T: 10, range: "any", from: "", to: "", sort: "date", dir: "desc", group: true, limit: 80, ...over };
  }
  function rangeBounds(st, now = Date.now()) {
    const today = isoDay(now);
    if (st.range === "today") return [today, today];
    if (st.range === "7") return [isoDay(now - 6 * DAY), today];
    if (st.range === "30") return [isoDay(now - 29 * DAY), today];
    if (st.range === "month") return [today.slice(0, 8) + "01", today];
    if (st.range === "custom") return [st.from, st.to];
    return ["", ""];
  }
  const isFiltered = (st) => Boolean(st.q.trim()) || st.filter !== "all" || st.range !== "any";
  const clampT = (v) => Math.min(T_MAX, Math.max(T_MIN, Math.round(v * 100) / 100));

  const haystacks = new WeakMap();
  function searchText(s, ctx) {
    const sig = `${s.rawMs}|${s.penalty}|${s.note}|${s.scramble}|${s.date}`;
    let h = haystacks.get(s);
    if (!h || h.sig !== sig) {
      h = { sig, text: `${ctx.format(ctx.value(s))} ${s.scramble || ""} ${s.note || ""} ${s.penalty || ""} ${s.originalDate || s.date || ""}`.toLowerCase() };
      haystacks.set(s, h);
    }
    return h.text;
  }
  function select(solves, st, ctx) {
    const q = st.q.trim().toLowerCase(), [from, to] = rangeBounds(st, ctx.now ? ctx.now() : Date.now());
    const out = [];
    for (const s of solves) {
      if (q && !searchText(s, ctx).includes(q)) continue;
      if (st.filter === "sub" && !(ctx.value(s) < st.T)) continue;
      if (st.filter === "plus" && s.penalty !== "+2") continue;
      if (st.filter === "dnf" && s.penalty !== "DNF") continue;
      if (from || to) {
        const d = ctx.dateOf(s);
        if (!d) continue;
        const day = isoDay(d);
        if ((from && day < from) || (to && day > to)) continue;
      }
      out.push(s);
    }
    if (st.sort === "time") {
      const sign = st.dir === "desc" ? -1 : 1;   // asc = fastest first. Array sort is stable, so ties stay in the order they were solved.
      out.sort((a, b) => {
        const x = ctx.value(a), y = ctx.value(b);
        return x === y ? 0 : x < y ? -sign : sign;
      });
    } else if (st.dir === "desc") out.reverse();
    return out;
  }
  function dayLabel(iso, now = Date.now()) {
    if (!iso) return "No date";
    if (iso === isoDay(now)) return "Today";
    if (iso === isoDay(now - DAY)) return "Yesterday";
    const d = parseISO(iso), year = d.getFullYear() !== new Date(now).getFullYear();
    return d.toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}) });
  }
  function monthGrid(year, month) {
    const lead = (new Date(year, month, 1).getDay() + 6) % 7;
    const total = Math.ceil((lead + new Date(year, month + 1, 0).getDate()) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(year, month, 1 - lead + i);
      return { iso: isoDay(d), day: d.getDate(), outside: d.getMonth() !== month };
    });
  }

  /* ------------------------------------------------------------------- view */
  const PEN = [["", "OK"], ["+2", "+2"], ["DNF", "DNF"]];
  const FILTERS = [["all", "All"], ["sub", "Sub"], ["plus", "+2"], ["dnf", "DNF"]];

  function create(host, ctx) {
    const st = ctx.state, esc = ctx.esc;
    const now = () => (ctx.now ? ctx.now() : Date.now());
    const reduced = () => (typeof ctx.reduced === "function" ? ctx.reduced() : matchMedia("(prefers-reduced-motion: reduce)").matches);
    const ref = (name) => host.querySelector(`[data-ref="${name}"]`);
    const mk = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
    let current = [], index = new Map(), daysWithSolves = new Set(), bestId = null, disposed = false, selectedId = null;
    const cleanups = [];
    const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); cleanups.push(() => target.removeEventListener(type, fn, opts)); };

    host.innerHTML = `
      <div class="lib">
        <div class="lib-summary" data-ref="summary"></div>
        <div class="lib-sticky">
          <div class="lib-tools">
            <div class="lib-search" data-ref="searchBox">
              ${ctx.icon("search")}
              <input data-ref="q" type="search" autocomplete="off" spellcheck="false" placeholder="Search time, scramble or note" aria-label="Search solves" value="${esc(st.q)}">
              <button class="lib-clear" data-ref="clearQ" aria-label="Clear search" tabindex="-1">${ctx.icon("close")}</button>
              <kbd>/</kbd>
            </div>
            <div class="lib-seg" data-ref="filters" role="group" aria-label="Filter solves">
              <i class="thumb"></i>
              ${FILTERS.map(([v, label]) => v === "sub"
                ? `<span class="it sub" data-v="sub" tabindex="0" title="Solves faster than T seconds">Sub<button class="step" data-step="-1" aria-label="Lower the limit" tabindex="-1">−</button><input data-ref="subT" inputmode="decimal" aria-label="Seconds" value="${esc(String(st.T))}"><button class="step" data-step="1" aria-label="Raise the limit" tabindex="-1">+</button><span class="u">s</span></span>`
                : `<span class="it" data-v="${v}" tabindex="0">${label}</span>`).join("")}
            </div>
            <div class="lib-datewrap">
              <button class="lib-datebtn" data-ref="dateBtn" aria-haspopup="dialog" aria-expanded="false">${ctx.icon("calendar")}<span class="lbl" data-ref="dateLabel">Any time</span>${ctx.icon("down")}</button>
              <div class="lib-pop lib-datepop" data-ref="datePop" role="dialog" aria-label="Choose dates">
                <div class="lib-presets" data-ref="presets"></div>
                <div class="lib-cal">
                  <div class="lib-cal-head"><button data-ref="prevM" aria-label="Previous month">${ctx.icon("left")}</button><b data-ref="monthT"></b><button data-ref="nextM" aria-label="Next month">${ctx.icon("chevron")}</button></div>
                  <div class="lib-dow"><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span></div>
                  <div class="lib-days" data-ref="days"></div>
                  <div class="lib-cal-foot"><span data-ref="calInfo"></span><button class="lib-linkbtn" data-ref="calClear">Clear</button></div>
                </div>
              </div>
            </div>
            <div class="lib-right">
              <button class="lib-linkbtn" data-ref="reset">Reset</button>
              <label class="lib-switch" data-ref="groupSwitch" title="Put a heading above each day"><input type="checkbox" role="switch" data-ref="group"><i></i><span>By day</span></label>
              <span class="lib-count" data-ref="count" aria-live="polite"></span>
            </div>
          </div>
          <div class="lib-cols" data-ref="cols">
            <button class="sortable" data-sort="date">Solve<svg class="arr" viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></svg></button>
            <button class="sortable" data-sort="time">Time<svg class="arr" viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></svg></button>
            <span>ao5</span><span>Scramble</span><span data-ref="whenHead">At</span><span></span>
          </div>
        </div>
        <div class="lib-list" data-ref="list"></div>
        <div class="lib-sentinel" data-ref="sentinel" aria-hidden="true"></div>
      </div>`;

    /* ---- derived data: rebuilt when the solves change, not when a filter does ---- */
    function rebuild() {
      const all = ctx.solves();
      index = new Map(); daysWithSolves = new Set(); bestId = null;
      let best = Infinity;
      all.forEach((s, i) => {
        index.set(s.id, i);
        const d = ctx.dateOf(s);
        if (d) daysWithSolves.add(isoDay(d));
        const v = ctx.value(s);
        if (Number.isFinite(v) && v < best) { best = v; bestId = s.id; }
      });
    }

    /* ---- summary, toolbar state ---- */
    function paintSummary() {
      const s = ctx.stats(), stat = (n, label, cls = "") => `<div class="lib-stat ${cls}"><b>${n}</b><span>${label}</span></div>`;
      ref("summary").innerHTML = stat(s.count.toLocaleString(), "solves") + stat(ctx.format(s.best), "best", "best") + stat(ctx.format(s.mean), "mean") + stat(String(s.dnf), "DNF");
    }
    function placeThumb() {
      const seg = ref("filters"), th = seg.querySelector(".thumb"), on_ = seg.querySelector(".it.on");
      if (!on_ || !on_.offsetWidth) { th.style.width = "0"; return; }
      th.style.width = on_.offsetWidth + "px";
      th.style.transform = `translateX(${on_.offsetLeft}px)`;
    }
    function dateText() {
      if (st.range === "custom") {
        const f = (iso) => parseISO(iso).toLocaleDateString("en", { month: "short", day: "numeric", ...(parseISO(iso).getFullYear() !== new Date(now()).getFullYear() ? { year: "numeric" } : {}) });
        return st.from && st.to ? (st.from === st.to ? f(st.from) : `${f(st.from)} – ${f(st.to)}`) : "Any time";
      }
      return (RANGES.find((r) => r[0] === st.range) || RANGES[0])[1];
    }
    function paintMeta() {
      const total = ctx.solves().length, n = current.length, active = isFiltered(st);
      ref("count").innerHTML = active ? `<b>${n.toLocaleString()}</b> of ${total.toLocaleString()} solves` : `<b>${total.toLocaleString()}</b> solves`;
      ref("reset").classList.toggle("show", active);
      ref("searchBox").classList.toggle("has", Boolean(st.q));
      ref("dateLabel").textContent = dateText();
      ref("dateBtn").classList.toggle("on", st.range !== "any");
      host.querySelectorAll("[data-ref=filters] .it").forEach((b) => b.classList.toggle("on", b.dataset.v === st.filter));
      placeThumb();
      const byDate = st.sort === "date";
      ref("whenHead").textContent = byDate && st.group ? "At" : "Recorded";
      const sw = ref("groupSwitch");
      ref("group").checked = st.group;
      sw.classList.toggle("off", !byDate);
      ref("group").disabled = !byDate;
      sw.title = byDate ? "Put a heading above each day" : "Days are only grouped while sorted by Solve";
      host.querySelectorAll("[data-ref=cols] .sortable").forEach((b) => {
        const on_ = b.dataset.sort === st.sort;
        b.classList.toggle("on", on_);
        b.classList.toggle("asc", on_ && st.dir === "asc");
      });
    }

    /* ---- rows ---- */
    const hl = (text, q) => {
      if (!q) return esc(text);
      const i = text.toLowerCase().indexOf(q);
      return i < 0 ? esc(text) : `${esc(text.slice(0, i))}<mark>${esc(text.slice(i, i + q.length))}</mark>${esc(text.slice(i + q.length))}`;
    };
    const clock = (d) => d.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });
    function whenCell(s, grouped) {
      const d = ctx.dateOf(s);
      if (!d) return "—";
      if (grouped) return `<b>${clock(d)}</b>`;
      const iso = isoDay(d), n = now();
      const day = iso === isoDay(n) ? "Today" : iso === isoDay(n - DAY) ? "Yesterday" : d.toLocaleDateString("en", { month: "short", day: "numeric", ...(d.getFullYear() !== new Date(n).getFullYear() ? { year: "numeric" } : {}) });
      return `<b>${day}</b> · ${clock(d)}`;
    }
    // A DNF keeps the time it was on the clock: the number is struck through and "DNF" stays legible beside it.
    // A DNF with no recorded time (typed in by hand) has nothing to strike, so it reads plain "DNF".
    function timeHTML(s, v, dnf, q) {
      if (dnf) return s.rawMs > 0 ? `<s>${hl(ctx.format(s.rawMs / 1000), q)}</s><small class="tag">DNF</small>` : hl("DNF", q);
      return hl(ctx.format(v), q) + (s.penalty === "+2" ? "<small>+2</small>" : "");
    }
    function rowHTML(s, q, grouped) {
      const i = index.get(s.id), v = ctx.value(s), dnf = s.penalty === "DNF";
      const ao = i >= 4 ? ctx.format(ctx.average(ctx.solves().slice(i - 4, i + 1), 5)) : "–";
      const note = s.note ? `<span class="n" title="${esc(s.note)}">${ctx.icon("note")}<em>${hl(s.note, q)}</em></span>` : "";
      return `<div class="lib-row${dnf ? " dnf" : ""}${s.id === bestId ? " best" : ""}${s.id === selectedId ? " sel" : ""}" data-key="r:${esc(s.id)}" data-id="${esc(s.id)}" tabindex="0" role="button" aria-label="Open solve ${i + 1}">
        <span class="no">#${i + 1}</span>
        <span class="time">${timeHTML(s, v, dnf, q)}${ctx.badges(s)}</span>
        <span class="ao">${ao}</span>
        <span class="scr" title="${esc(s.scramble || "")}"><span class="s">${hl(s.scramble || "No scramble recorded", q)}</span>${note}</span>
        <span class="when">${whenCell(s, grouped)}</span>
        <span class="tools-r"><span class="pen">${PEN.map(([p, label]) => `<button data-pen="${p}" class="${s.penalty === p ? "on" : ""}" tabindex="-1">${label}</button>`).join("")}</span><button class="mini" data-act="copy" aria-label="Copy scramble" title="Copy scramble" tabindex="-1">${ctx.icon("copy")}</button><button class="mini del" data-act="del" aria-label="Delete solve" title="Delete" tabindex="-1">${ctx.icon("trash")}</button></span>
      </div>`;
    }
    function listItems() {
      const q = st.q.trim().toLowerCase(), out = [];
      if (!current.length) {
        const searching = Boolean(q);
        out.push({ key: "empty", html: `<div class="lib-empty" data-key="empty"><b>${searching ? `No solves match “${esc(st.q.trim())}”` : "No solves here"}</b><p>${searching ? "Try a time like 9.8, a move like R2, or a word from a note." : "Nothing fits these filters."}</p><button class="lib-btn" data-ref="emptyReset">Reset filters</button></div>` });
        return out;
      }
      const shown = current.slice(0, st.limit), grouped = st.group && st.sort === "date";
      const counts = new Map();
      if (grouped) for (const s of current) { const d = ctx.dateOf(s), k = d ? isoDay(d) : ""; counts.set(k, (counts.get(k) || 0) + 1); }
      let last = null;
      for (const s of shown) {
        if (grouped) {
          const d = ctx.dateOf(s), k = d ? isoDay(d) : "";
          if (k !== last) {
            last = k;
            const c = counts.get(k);
            out.push({ key: "d:" + k, html: `<div class="lib-day" data-key="d:${k}"><b>${esc(dayLabel(k, now()))}</b><span>${c.toLocaleString()} ${c === 1 ? "solve" : "solves"}</span></div>` });
          }
        }
        out.push({ key: "r:" + s.id, html: rowHTML(s, q, grouped) });
      }
      if (current.length > shown.length) out.push({ key: "more", html: `<div class="lib-more" data-key="more">Showing ${shown.length.toLocaleString()} of ${current.length.toLocaleString()} · keep scrolling</div>` });
      return out;
    }

    /* Keyed repaint with FLIP: rows that stay slide to their new place, rows that arrive fade up, rows that leave
       fade out. Only what is near the viewport animates; everything else simply appears. */
    function paintList(animate = true) {
      const list = ref("list"), items = listItems(), keep = new Set(items.map((i) => i.key));
      const lr = list.getBoundingClientRect(), oldH = list.offsetHeight;
      const focusKey = document.activeElement?.closest?.(".lib-row")?.dataset.key;
      const old = new Map(), first = new Map();
      for (const el of [...list.children]) { const k = el.dataset.key; if (!k) continue; old.set(k, el); first.set(k, el.getBoundingClientRect()); }
      const next = [];
      for (const it of items) {
        const el = old.get(it.key);
        if (el && el._html === it.html) { next.push(el); continue; }
        const n = mk(it.html); n._html = it.html;
        if (el) el.replaceWith(n);
        next.push(n);
      }
      const exiting = [];
      old.forEach((el, k) => { if (!keep.has(k)) exiting.push([k, el]); });
      const animateIt = animate && !reduced() && first.size > 0;
      if (animateIt) list.style.minHeight = oldH + "px";
      for (const [k, el] of exiting) {
        const r = first.get(k);
        if (!animateIt || r.bottom < -150 || r.top > innerHeight + 150) { el.remove(); continue; }
        el.style.cssText = `position:absolute;left:0;top:${r.top - lr.top}px;width:${r.width}px;height:${r.height}px;margin:0;pointer-events:none`;
        el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(-14px) scale(.985)" }], { duration: 200, easing: "ease-in" }).onfinish = () => el.remove();
      }
      list.append(...next);
      let n = 0;
      if (animateIt) for (const el of next) {
        const f = first.get(el.dataset.key), l = el.getBoundingClientRect();
        if (l.bottom < -150 || l.top > innerHeight + 150) continue;
        if (f) { const dy = f.top - l.top; if (Math.abs(dy) > .5) el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 380, easing: "cubic-bezier(.2,.8,.2,1)" }); }
        else el.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 340, delay: (exiting.length ? 90 : 0) + Math.min(n++, 12) * 22, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
      }
      if (animateIt) setTimeout(() => { list.style.minHeight = ""; }, 420);
      if (focusKey && !document.activeElement?.closest?.(".lib-row")) {
        const el = [...list.children].find((c) => c.dataset.key === focusKey);
        el?.focus({ preventScroll: true });
      }
    }

    /* ---- one entry point for "something about what is shown changed" ---- */
    function update(keepLimit, animate = true) {
      if (disposed) return;
      if (!keepLimit) st.limit = 80;
      current = select(ctx.solves(), st, ctx);
      paintMeta();
      paintList(animate);
      if (picker.open) picker.paint(false);
    }
    function refresh() {
      if (disposed) return;
      rebuild();
      paintSummary();
      update(true, true);
    }

    /* ---- filters ---- */
    const subInput = ref("subT");
    const showT = () => { subInput.value = String(+st.T.toFixed(2)); };
    const setFilter = (v) => { if (st.filter === v) return; st.filter = v; update(); };
    function stepT(d) { st.T = clampT(st.T + d); showT(); st.filter = "sub"; ctx.persist?.(); update(); }
    on(ref("filters"), "click", (e) => {
      const stepB = e.target.closest(".step");
      if (stepB) { e.stopPropagation(); stepT(+stepB.dataset.step * (e.shiftKey ? .1 : .5)); return; }
      const it = e.target.closest(".it");
      if (!it) return;
      setFilter(it.dataset.v);
      if (it.dataset.v === "sub" && e.target === subInput) subInput.select();
    });
    on(ref("filters"), "keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("it")) { e.preventDefault(); e.target.click(); }
    });
    let tDebounce = 0;
    on(subInput, "input", () => {
      const v = parseFloat(subInput.value.replace(",", "."));
      if (!(v > 0)) return;
      st.T = Math.min(T_MAX, v);
      clearTimeout(tDebounce);
      tDebounce = setTimeout(() => { st.filter = "sub"; ctx.persist?.(); update(); }, 160);
    });
    on(subInput, "focus", () => setFilter("sub"));
    on(subInput, "blur", showT);
    on(subInput, "keydown", (e) => {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); stepT((e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? .1 : .5)); }
      else if (e.key === "Enter") subInput.blur();
    });

    /* ---- search: one repaint shortly after the last key; focus and caret never move ---- */
    const q = ref("q");
    let searchTimer = 0;
    on(q, "input", () => {
      ref("searchBox").classList.toggle("has", Boolean(q.value));
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { st.q = q.value; update(); }, 140);
    });
    on(q, "focus", () => ref("searchBox").classList.add("focus"));
    on(q, "blur", () => ref("searchBox").classList.remove("focus"));
    on(ref("clearQ"), "click", () => { q.value = ""; st.q = ""; update(); q.focus(); });
    function resetAll() { clearTimeout(searchTimer); st.q = ""; q.value = ""; st.filter = "all"; st.range = "any"; st.from = st.to = ""; picker.anchor = null; update(); }
    on(ref("reset"), "click", resetAll);

    /* ---- grouping + sorting ---- */
    on(ref("group"), "change", () => { st.group = ref("group").checked; ctx.persist?.(); update(true); });
    on(ref("cols"), "click", (e) => {
      const b = e.target.closest(".sortable");
      if (!b) return;
      const k = b.dataset.sort;
      if (st.sort === k) st.dir = st.dir === "desc" ? "asc" : "desc";
      else { st.sort = k; st.dir = k === "time" ? "asc" : "desc"; }
      update();
    });

    /* ---- date picker: presets plus our own calendar ---- */
    const picker = (() => {
      const pop = ref("datePop"), p = { open: false, anchor: null };
      let month = null, hover = null;
      const firstOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
      function paint(swap, dir = 1) {
        const today = isoDay(now());
        ref("presets").innerHTML = RANGES.map(([k, l]) => `<button data-p="${k}" class="${st.range === k ? "on" : ""}">${l}</button>`).join("");
        ref("monthT").textContent = month.toLocaleDateString("en", { month: "long", year: "numeric" });
        let [from, to] = rangeBounds(st, now());
        if (p.anchor) { const a = p.anchor, b = hover || p.anchor; [from, to] = a <= b ? [a, b] : [b, a]; }
        const cells = monthGrid(month.getFullYear(), month.getMonth());
        ref("days").innerHTML = cells.map((c) => {
          const inR = from && to && c.iso >= from && c.iso <= to, s = from && c.iso === from, e = to && c.iso === to;
          return `<div class="lib-day-c${c.outside ? " out" : ""}${c.iso > today ? " dis" : ""}${c.iso === today ? " today" : ""}${daysWithSolves.has(c.iso) ? " has" : ""}${inR ? " mid" : ""}${s ? " s" : ""}${e ? " e" : ""}" data-d="${c.iso}" role="button" tabindex="-1" aria-label="${c.iso}"><i></i><span>${c.day}</span></div>`;
        }).join("");
        const days = ref("days");
        if (swap && !reduced()) { days.style.setProperty("--dir", dir * 14 + "px"); days.classList.remove("swap"); void days.offsetWidth; days.classList.add("swap"); }
        const t = new Date(now());
        ref("nextM").disabled = month.getFullYear() * 12 + month.getMonth() >= t.getFullYear() * 12 + t.getMonth();
        const [ra, rb] = rangeBounds(st, now());
        let inRange = ctx.solves().length;
        if (ra || rb) inRange = ctx.solves().reduce((n, s) => { const d = ctx.dateOf(s); if (!d) return n; const k = isoDay(d); return n + ((!ra || k >= ra) && (!rb || k <= rb) ? 1 : 0); }, 0);
        ref("calInfo").innerHTML = p.anchor ? "Pick the last day" : `<b>${inRange.toLocaleString()}</b> ${inRange === 1 ? "solve" : "solves"} in range`;
        ref("calClear").style.visibility = st.range === "any" ? "hidden" : "visible";
      }
      function toggle(open = !p.open) {
        p.open = open;
        pop.classList.toggle("open", open);
        ref("dateBtn").setAttribute("aria-expanded", String(open));
        if (open) {
          const [a, b] = rangeBounds(st, now()), at = b || a;
          month = firstOfMonth(at ? parseISO(at) : new Date(now()));
          p.anchor = null; hover = null;
          paint(false);
          fit();
        }
      }
      // keep the popover inside the window: start at the button's left edge, then slide left just enough to fit
      function fit() {
        pop.style.left = "";
        const wrap = pop.parentElement.getBoundingClientRect();   // offsetWidth, not a rect: the popover is mid-transform while it opens
        const shift = Math.min(0, innerWidth - 8 - (wrap.left + pop.offsetWidth));
        pop.style.left = Math.max(shift, 8 - wrap.left) + "px";
      }
      on(ref("dateBtn"), "click", () => toggle());
      on(ref("prevM"), "click", () => { month = new Date(month.getFullYear(), month.getMonth() - 1, 1); paint(true, -1); });
      on(ref("nextM"), "click", () => { month = new Date(month.getFullYear(), month.getMonth() + 1, 1); paint(true, 1); });
      on(ref("calClear"), "click", () => { st.range = "any"; st.from = st.to = ""; p.anchor = null; update(); toggle(false); });
      on(ref("presets"), "click", (e) => {
        const b = e.target.closest("[data-p]");
        if (!b) return;
        st.range = b.dataset.p; st.from = st.to = ""; p.anchor = null;
        update();
        setTimeout(() => toggle(false), 140);
      });
      on(ref("days"), "click", (e) => {
        const c = e.target.closest(".lib-day-c");
        if (!c || c.classList.contains("dis")) return;
        const d = c.dataset.d;
        if (!p.anchor) { p.anchor = d; hover = d; paint(false); return; }
        const [a, b] = p.anchor <= d ? [p.anchor, d] : [d, p.anchor];
        st.from = a; st.to = b; st.range = "custom"; p.anchor = null; hover = null;
        update();
        setTimeout(() => toggle(false), 220);
      });
      on(ref("days"), "mouseover", (e) => {
        if (!p.anchor) return;
        const c = e.target.closest(".lib-day-c");
        if (!c || c.classList.contains("dis") || c.dataset.d === hover) return;
        hover = c.dataset.d;
        paint(false);
      });
      p.paint = paint; p.toggle = toggle;
      return p;
    })();

    /* ---- rows: open, quick actions ---- */
    on(ref("list"), "click", (e) => {
      if (e.target.closest("[data-ref=emptyReset]")) { resetAll(); return; }
      const row = e.target.closest(".lib-row");
      if (!row) return;
      const id = row.dataset.id, pen = e.target.closest("[data-pen]"), act = e.target.closest("[data-act]");
      if (pen) { ctx.setPenalty(id, pen.dataset.pen); return; }
      if (act?.dataset.act === "copy") { const s = ctx.solves()[index.get(id)]; if (s) ctx.copy(s.scramble || ""); return; }
      if (act?.dataset.act === "del") { ctx.remove(id); return; }
      if (window.getSelection?.().toString()) return;   // selecting scramble text must not open the dialog
      selectedId = id;
      host.querySelectorAll(".lib-row.sel").forEach((r) => r.classList.remove("sel"));
      row.classList.add("sel");
      ctx.open(id);
    });

    /* ---- keyboard ---- */
    on(document, "keydown", (e) => {
      if (disposed || !host.isConnected) return;
      const active = document.activeElement, typing = /^(INPUT|TEXTAREA|SELECT)$/.test(active?.tagName || "");
      if (document.querySelector("#dialog")?.open) return;
      if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey) { e.preventDefault(); q.focus(); q.select(); }
      else if (e.key === "Escape") {
        if (active === q) { if (q.value) { q.value = ""; st.q = ""; update(); } else q.blur(); }
        if (picker.open) picker.toggle(false);
      } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && (!typing || active === q)) {
        const rows = [...host.querySelectorAll(".lib-row")];
        if (!rows.length) return;
        e.preventDefault();
        let i = rows.indexOf(active);
        i = e.key === "ArrowDown" ? Math.min(rows.length - 1, i + 1) : Math.max(0, i < 0 ? 0 : i - 1);
        rows[i].focus();
        rows[i].scrollIntoView({ block: "nearest" });
      } else if ((e.key === "Enter" || e.key === " ") && active?.classList?.contains("lib-row")) { e.preventDefault(); active.click(); }
    });
    on(document, "click", (e) => { if (picker.open && e.target.isConnected && !e.target.closest(".lib-datewrap")) picker.toggle(false); });   // a day cell is repainted on click and is no longer attached: that click was inside
    on(window, "resize", placeThumb);

    /* ---- infinite scroll ---- */
    let observer = null;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((x) => x.isIntersecting) && st.limit < current.length) { st.limit += 120; paintList(false); }
      }, { rootMargin: "900px" });
      observer.observe(ref("sentinel"));
    }
    document.fonts?.ready.then(placeThumb);

    rebuild();
    paintSummary();
    ref("group").checked = st.group;
    current = select(ctx.solves(), st, ctx);
    paintMeta();
    paintList(false);
    requestAnimationFrame(placeThumb);

    return {
      refresh, update, results: () => current,
      destroy() { disposed = true; clearTimeout(searchTimer); clearTimeout(tDebounce); observer?.disconnect(); cleanups.forEach((f) => f()); },
    };
  }

  const api = { defaultState, select, rangeBounds, dayLabel, monthGrid, searchText, isoDay, parseISO, clampT, isFiltered, RANGES, create };
  root.CTLibrary = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
