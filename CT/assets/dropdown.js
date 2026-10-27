/*
 * Dropdown: one shared look and behaviour for every <select> in the app.
 *
 * It enhances the native element instead of replacing it. The <select> stays in
 * the DOM as the source of truth (value, disabled, options, change events), so
 * existing `data-control` handlers and `select.value = …` assignments keep
 * working. A trigger button and a floating menu are drawn on top of it.
 *
 *   <select data-control="x">          default look
 *   <select data-dd="compact">         smaller, for filters and toolbars
 *   <select data-native>               opt out, keep the browser's own picker
 *
 * Touch devices keep the native picker, which is better there.
 * Styles live in style.css under "dropdown".
 */
(() => {
  const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  const coarse = matchMedia("(pointer: coarse)");
  const instances = new Set();
  let open = null;
  let seed = 0;

  class Dropdown {
    constructor(select) {
      this.select = select;
      this.id = `dd-${++seed}`;
      this.typed = "";
      this.typedTimer = 0;
      this.build();
      this.watch();
      this.sync();
      instances.add(this);
    }

    build() {
      const { select } = this;
      select.classList.add("dd-native");
      select.tabIndex = -1;
      select.setAttribute("aria-hidden", "true");

      this.root = document.createElement("div");
      this.root.className = `dd dd-${select.dataset.dd || "default"}`;
      this.trigger = document.createElement("button");
      this.trigger.type = "button";
      this.trigger.className = "dd-trigger";
      this.trigger.setAttribute("aria-haspopup", "listbox");
      this.trigger.setAttribute("aria-expanded", "false");
      const label = select.getAttribute("aria-label");
      if (label) this.trigger.setAttribute("aria-label", label);
      this.trigger.innerHTML = `<span class="dd-value"></span>${CHEVRON}`;
      this.valueEl = this.trigger.firstElementChild;
      this.root.append(this.trigger);
      select.after(this.root);

      this.menu = document.createElement("div");
      this.menu.className = `dd-menu dd-menu-${select.dataset.dd || "default"}`;
      this.menu.id = this.id;
      this.menu.setAttribute("role", "listbox");
      this.menu.popover = "manual";
      if (label) this.menu.setAttribute("aria-label", label);

      this.trigger.addEventListener("click", () => (this.isOpen ? this.close() : this.show()));
      this.trigger.addEventListener("keydown", (e) => this.onTriggerKey(e));
      this.menu.addEventListener("keydown", (e) => this.onMenuKey(e));
      this.menu.addEventListener("click", (e) => {
        const option = e.target.closest(".dd-option");
        if (option && !option.disabled) this.choose(Number(option.dataset.index));
      });
      // A <label> wrapping the select forwards focus to it; hand it to the trigger.
      select.addEventListener("focus", () => this.trigger.focus());
      // Changes made to the native element itself (assistive tech, tests, autofill).
      select.addEventListener("change", () => this.sync());
    }

    // Programmatic changes (select.value = …, options rebuilt, disabled toggled)
    // fire no event, so mirror them.
    watch() {
      const { select } = this;
      Object.defineProperty(select, "value", {
        configurable: true,
        get() {
          return valueDescriptor.get.call(this);
        },
        set: (next) => {
          valueDescriptor.set.call(select, next);
          this.sync();
        },
      });
      this.observer = new MutationObserver(() => this.sync());
      this.observer.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "selected", "label"] });
    }

    get isOpen() {
      return open === this;
    }

    sync() {
      const { select } = this;
      const current = select.options[select.selectedIndex];
      this.valueEl.textContent = current ? current.text : "";
      this.valueEl.classList.toggle("dd-placeholder", !current || current.value === "");
      this.trigger.disabled = select.disabled;
      if (this.isOpen) this.renderOptions();
    }

    renderOptions() {
      const { select } = this;
      this.menu.replaceChildren(
        ...Array.from(select.options, (option, index) => {
          const el = document.createElement("button");
          el.type = "button";
          el.className = "dd-option";
          el.setAttribute("role", "option");
          el.dataset.index = index;
          el.disabled = option.disabled;
          el.setAttribute("aria-selected", String(index === select.selectedIndex));
          el.innerHTML = `<span></span>${CHECK}`;
          el.firstElementChild.textContent = option.text;
          return el;
        }),
      );
    }

    show() {
      if (this.select.disabled) return;
      if (open && open !== this) open.close();
      open = this;
      this.renderOptions();
      // The menu must live inside an open <dialog>, because a modal dialog makes the
      // rest of the page inert. Promoting it to the top layer (popover) then frees
      // it from the dialog's own transform, which would otherwise become the
      // reference for its fixed position and clip it to the dialog.
      (this.root.closest("dialog") || document.body).append(this.menu);
      this.menu.showPopover?.();
      this.trigger.setAttribute("aria-expanded", "true");
      this.root.classList.add("open");
      this.place();
      requestAnimationFrame(() => this.menu.classList.add("show"));
      this.menu.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true });
      this.menu.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    }

    close(restoreFocus = false) {
      if (!this.isOpen) return;
      open = null;
      this.menu.classList.remove("show");
      if (this.menu.matches(":popover-open")) this.menu.hidePopover();
      this.menu.remove();
      this.root.classList.remove("open");
      this.trigger.setAttribute("aria-expanded", "false");
      if (restoreFocus) this.trigger.focus({ preventScroll: true });
    }

    // Open below the trigger, or above it when that side has more room.
    place() {
      const rect = this.trigger.getBoundingClientRect();
      const gap = 6;
      const margin = 12;
      const wanted = Math.min(this.menu.scrollHeight || 320, 320);
      const below = innerHeight - rect.bottom - margin;
      const above = rect.top - margin;
      const down = below >= wanted || below >= above;
      const room = Math.max(120, down ? below : above) - gap;
      const style = this.menu.style;
      style.minWidth = `${rect.width}px`;
      style.maxHeight = `${Math.min(320, room)}px`;
      style.left = `${Math.max(margin, Math.min(rect.left, innerWidth - margin - Math.max(rect.width, this.menu.offsetWidth)))}px`;
      this.menu.dataset.side = down ? "down" : "up";
      if (down) {
        style.top = `${rect.bottom + gap}px`;
        style.bottom = "auto";
      } else {
        style.top = "auto";
        style.bottom = `${innerHeight - rect.top + gap}px`;
      }
    }

    choose(index) {
      const { select } = this;
      if (index !== select.selectedIndex) {
        valueDescriptor.set.call(select, select.options[index].value);
        this.sync();
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      this.close(true);
    }

    move(from, step) {
      const options = Array.from(this.menu.querySelectorAll(".dd-option:not(:disabled)"));
      if (!options.length) return;
      const at = options.indexOf(from);
      const next = options[(at + step + options.length) % options.length];
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: "nearest" });
    }

    // Type a few letters to jump to a matching option, like the native control.
    typeahead(key) {
      clearTimeout(this.typedTimer);
      this.typed += key.toLowerCase();
      this.typedTimer = setTimeout(() => (this.typed = ""), 700);
      return Array.from(this.select.options).findIndex((o) => !o.disabled && o.text.toLowerCase().startsWith(this.typed));
    }

    onTriggerKey(e) {
      if (["ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        this.show();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== " ") {
        const index = this.typeahead(e.key);
        if (index >= 0) this.choose(index);
      }
    }

    onMenuKey(e) {
      const option = e.target.closest(".dd-option");
      const keys = {
        ArrowDown: () => this.move(option, 1),
        ArrowUp: () => this.move(option, -1),
        Home: () => this.move(null, 1),
        End: () => this.move(null, -1),
        Escape: () => this.close(true),
        Tab: () => this.close(),
      };
      if (keys[e.key]) {
        // Escape must not also close the dialog the menu is in.
        if (e.key !== "Tab") e.preventDefault();
        e.stopPropagation();
        keys[e.key]();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== " ") {
        const index = this.typeahead(e.key);
        this.menu.querySelector(`[data-index="${index}"]`)?.focus({ preventScroll: true });
      }
    }

    destroy() {
      this.close();
      this.observer.disconnect();
      this.root.remove();
      instances.delete(this);
    }
  }

  const enhancible = (select) => !select.multiple && !("native" in select.dataset) && !select.dd && !coarse.matches;

  function enhance(root = document) {
    const selects = root.matches?.("select") ? [root] : root.querySelectorAll?.("select") ?? [];
    for (const select of selects) {
      if (enhancible(select)) select.dd = new Dropdown(select);
    }
  }

  // Selects arrive and leave with every re-render, so watch the page instead of
  // asking each render function to call us.
  new MutationObserver((mutations) => {
    for (const { addedNodes } of mutations) {
      for (const node of addedNodes) if (node.nodeType === 1 && !node.classList.contains("dd-menu")) enhance(node);
    }
    for (const dd of instances) if (!dd.select.isConnected) dd.destroy();
  }).observe(document.documentElement, { childList: true, subtree: true });

  // Anything that moves the trigger out from under an open menu closes it.
  document.addEventListener("pointerdown", (e) => {
    if (open && !open.menu.contains(e.target) && !open.root.contains(e.target)) open.close();
  }, true);
  // Scrolling (including a dialog nudging itself to show the focused option) just
  // re-places the menu; it closes only when its trigger has left the screen.
  const follow = (e) => {
    if (!open || open.menu.contains(e.target)) return;
    const rect = open.trigger.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight) open.close();
    else open.place();
  };
  addEventListener("resize", follow);
  addEventListener("scroll", follow, true);

  window.Dropdown = {
    enhance,
    /** Close the open menu; true if one was open (lets Esc handlers stop there). */
    closeOpen() {
      if (!open) return false;
      open.close(true);
      return true;
    },
  };
  enhance();
})();
