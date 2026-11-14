import { useEffect, useState } from "react";

const NO_KEYBOARD_TYPES = new Set(["button", "checkbox", "radio", "range", "color", "file", "submit", "reset", "image", "hidden"]);

function opensKeyboard(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !NO_KEYBOARD_TYPES.has(el.type) && !el.readOnly;
  return false;
}

/**
 * True while the on-screen keyboard is likely up: a text field has focus on a
 * touch device. Lets sheets hide bulky footers (totals, big buttons) that the
 * keyboard would otherwise squeeze the list behind. Always false on desktop.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    if (!touch) return;
    const update = () => setOpen(opensKeyboard(document.activeElement));
    // focusout fires before the next field gets focus; wait a tick so moving
    // between fields doesn't flash the footer.
    const onFocusOut = () => window.setTimeout(update, 50);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", onFocusOut);
    update();
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return open;
}
