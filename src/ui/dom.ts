type Attr = string | number | boolean | undefined | ((e: Event) => void);

/** Tiny element builder: h('button', { class: 'x', onclick: fn }, 'label'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, Attr> = {},
  ...kids: (Node | string | null | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids) if (c !== null && c !== false) el.append(c);
  return el;
}

/** Only touches the DOM when the text actually changes (we render every frame). */
export function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

export function setDisabled(el: HTMLButtonElement | HTMLInputElement | HTMLSelectElement, disabled: boolean): void {
  if (el.disabled !== disabled) el.disabled = disabled;
}

/** Sets a range input's value unless the player is dragging it. */
export function setRange(el: HTMLInputElement, value: number): void {
  if (document.activeElement !== el && Number(el.value) !== value) el.value = String(value);
}

export function bar(): { el: HTMLDivElement; set: (fraction: number, cls?: string) => void } {
  const fill = h('div', { class: 'bar-fill' });
  const el = h('div', { class: 'bar' }, fill);
  return {
    el,
    set(f, cls = '') {
      const w = `${Math.max(0, Math.min(1, f)) * 100}%`;
      if (fill.style.width !== w) fill.style.width = w;
      const c = `bar-fill ${cls}`.trim();
      if (fill.className !== c) fill.className = c;
    },
  };
}
