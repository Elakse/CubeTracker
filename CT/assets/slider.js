/*
 * Slider: one shared look for every <input type="range"> in the app.
 *
 * The control stays a plain native range input (value, min/max/step, input and
 * change events all unchanged). The only thing CSS cannot do is colour the
 * part of the track behind the thumb, so this keeps a `--fill` custom
 * property (0%–100%) in step with the value. Styles live in style.css under
 * "slider". Add a range input anywhere and it picks this up automatically.
 */
(() => {
  const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");

  function sync(input) {
    const min = Number(input.min || 0),
      max = Number(input.max || 100),
      span = max - min;
    const ratio = span > 0 ? (Number(valueDescriptor.get.call(input)) - min) / span : 0;
    input.style.setProperty("--fill", `${(Math.min(1, Math.max(0, ratio)) * 100).toFixed(1)}%`);
  }

  function enhance(root = document) {
    const inputs = root.matches?.('input[type="range"]') ? [root] : root.querySelectorAll?.('input[type="range"]') ?? [];
    for (const input of inputs) {
      if (input.slider) continue;
      input.slider = true;
      // Code that sets `input.value = …` fires no event, so mirror it.
      Object.defineProperty(input, "value", {
        configurable: true,
        get() {
          return valueDescriptor.get.call(this);
        },
        set(next) {
          valueDescriptor.set.call(this, next);
          sync(this);
        },
      });
      sync(input);
    }
  }

  document.addEventListener("input", (e) => {
    if (e.target.matches?.('input[type="range"]')) sync(e.target);
  });
  new MutationObserver((mutations) => {
    for (const { addedNodes } of mutations) for (const node of addedNodes) if (node.nodeType === 1) enhance(node);
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.Slider = { enhance, sync };
  enhance();
})();
