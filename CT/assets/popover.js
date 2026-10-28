/* Floating surfaces share placement, outside dismissal and Escape handling.
   Relative mode preserves the library calendar's layout; floating mode uses
   the top layer inside a modal dialog so neither clipping nor inertness wins. */
(() => {
  const instances = new Set();
  function create({ anchor, panel, floating = false, restoreFocus = false, onOpen, onClose }) {
    let open = false;
    const cleanup = [];
    const on = (el, event, fn, options) => {
      el.addEventListener(event, fn, options);
      cleanup.push(() => el.removeEventListener(event, fn, options));
    };
    function place() {
      if (!open || !anchor.isConnected) return;
      const margin = 8;
      if (!floating) {
        panel.style.left = "";
        const wrap = panel.parentElement.getBoundingClientRect();
        const shift = Math.min(0, innerWidth - margin - (wrap.left + panel.offsetWidth));
        panel.style.left = Math.max(shift, margin - wrap.left) + "px";
        return;
      }
      const r = anchor.getBoundingClientRect();
      panel.style.maxHeight = Math.max(80, innerHeight - 2 * margin) + "px";
      const height = panel.offsetHeight, below = innerHeight - r.bottom - margin;
      panel.style.left = Math.max(margin, Math.min(r.left, innerWidth - margin - panel.offsetWidth)) + "px";
      panel.style.top = Math.max(margin, Math.min(innerHeight - margin - height,
        below >= height || below >= r.top ? r.bottom + 8 : r.top - height - 8)) + "px";
    }
    function close(focus = restoreFocus) {
      if (!open) return false;
      open = false;
      panel.classList.remove("open");
      anchor.setAttribute("aria-expanded", "false");
      if (floating && panel.matches(":popover-open")) panel.hidePopover();
      if (floating) panel.hidden = true;
      onClose?.();
      if (focus && anchor.isConnected) anchor.focus({ preventScroll: true });
      return true;
    }
    function toggle(next = !open) {
      if (!next) { close(); return; }
      if (open) return;
      instances.forEach(p => { if (p !== api) p.close(false); });
      open = true;
      anchor.setAttribute("aria-expanded", "true");
      if (floating) {
        panel.popover = "manual";
        panel.hidden = false;
        (anchor.closest("dialog") || document.body).append(panel);
        panel.showPopover?.();
      }
      panel.classList.add("open");
      onOpen?.();
      place();
    }
    on(document, "click", e => {
      // Repainting a day removes the click target. Its composed path still
      // records that the click originated inside this surface.
      if (open && !e.composedPath().includes(panel) && !e.composedPath().includes(anchor)) close(false);
    });
    on(document, "keydown", e => {
      if (!open) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(true); }
      else if (floating && e.key === "Tab") close(false);
    }, true);
    on(window, "resize", place);
    if (floating) on(document, "scroll", place, true);
    const api = { toggle, close, place, get open() { return open; }, destroy() { close(false); cleanup.forEach(fn => fn()); instances.delete(api); if (floating) panel.remove(); } };
    instances.add(api);
    return api;
  }
  window.FloatingPopover = { create, closeOpen() { let closed = false; instances.forEach(p => { if (p.close()) closed = true; }); return closed; } };
})();
