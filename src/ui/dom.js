/**
 * Tiny helper for building UI without a framework:
 *   h('button', { class: 'big-button', onclick: fn }, '🔔 ', 'Ring')
 * Props starting with "on" become event listeners; `dataset` and `style`
 * objects are merged; everything else becomes an attribute.
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'class') el.className = value;
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

/** The layer all game overlays go into (above the 3D view and HUD). */
export function uiRoot() {
  return document.getElementById('ui');
}
