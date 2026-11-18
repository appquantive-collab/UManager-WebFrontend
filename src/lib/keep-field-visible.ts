import { opensKeyboard } from "./use-keyboard-open";

/**
 * Phones and tablets: when a text field is tapped, the keyboard slides up and
 * often covers it (or the field sits at the very bottom of a sheet). Once the
 * keyboard is up, bring the field into the part of the screen that's still
 * visible, a little above the keyboard, so the person sees what they type.
 * Works for page fields and fields inside dialogs and bottom sheets (it scrolls
 * whichever containers hold the field). Installed once for the whole app.
 */

const MARGIN = 24; // breathing room between the field and the keyboard / top edge

function visibleArea() {
  const vv = window.visualViewport;
  // getBoundingClientRect is relative to the layout viewport; the visual
  // viewport (what's not under the keyboard) starts at vv.offsetTop.
  return vv ? { top: vv.offsetTop, bottom: vv.offsetTop + vv.height } : { top: 0, bottom: window.innerHeight };
}

function isHidden(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const area = visibleArea();
  return rect.top < area.top + MARGIN || rect.bottom > area.bottom - MARGIN;
}

function reveal(el: HTMLElement) {
  if (document.activeElement !== el || !isHidden(el)) return;
  // Scrolls every scrollable container up to the page so the field sits mid-way in the visible area.
  el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  // iPhones don't shrink the page for the keyboard, so "center" can still be under it: nudge the page.
  window.setTimeout(() => {
    if (document.activeElement !== el) return;
    const rect = el.getBoundingClientRect();
    const area = visibleArea();
    const overflow = rect.bottom - (area.bottom - MARGIN);
    if (overflow > 0) window.scrollBy({ top: overflow, behavior: "smooth" });
  }, 260);
}

let installed = false;

export function keepFocusedFieldVisible() {
  if (installed || typeof window === "undefined") return;
  if (!window.matchMedia?.("(pointer: coarse)").matches) return; // desktops have no on-screen keyboard
  installed = true;
  let current: HTMLElement | null = null;
  let timers: number[] = [];

  document.addEventListener("focusin", (event) => {
    if (!opensKeyboard(event.target)) return;
    current = event.target as HTMLElement;
    timers.forEach(clearTimeout);
    // The keyboard takes ~250–400 ms to finish sliding up; check after it settles.
    timers = [window.setTimeout(() => current && reveal(current), 320), window.setTimeout(() => current && reveal(current), 700)];
  });

  document.addEventListener("focusout", () => {
    current = null;
  });

  // Keyboard opened/closed or switched (emoji/number pad): re-check the field in use.
  window.visualViewport?.addEventListener("resize", () => {
    if (current) window.setTimeout(() => current && reveal(current), 60);
  });
}
