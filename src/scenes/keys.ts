/**
 * A keyboard on the figures.
 *
 * Every playground in this project was pointer-only. Worse, two of them set
 * `tabindex="0"` on a canvas that handled no keys at all — so a keyboard user
 * tabbed in, got a focus ring, pressed everything they could think of, and
 * nothing happened. **That advertises an interaction it does not have**, which
 * is worse than not being focusable.
 *
 * The irony was that the *scroll-driven* scenes were the operable ones, purely
 * because `scroll.ts` drives a real `<input type="range">` and inherited its
 * keyboard behaviour for free. The hands-on scenes — the ones kept hands-on
 * precisely because "the reader's own hands are the point" — required those
 * hands to be holding a mouse.
 *
 * ## One vocabulary, like the gestures
 *
 * `docs/06` §4 fixes the gesture vocabulary across every scene — pinch is always
 * zoom, drag is always pan — because discoverability is poor and consistency is
 * the only affordance left. Keys get the same treatment:
 *
 * | | |
 * | --- | --- |
 * | **arrows** | move through the thing: the next slide, the next patch, the view |
 * | **Enter / Space** | commit what is under the cursor |
 * | **`+` / `-`** | zoom, where zooming is meaningful |
 *
 * Arrows are `preventDefault`ed, which is correct for a focused widget and is
 * why this only ever binds to an element the reader has deliberately focused.
 */

export interface KeyActions {
  /** Arrows. `dx`/`dy` are −1, 0 or 1 — one step, never a distance. */
  onStep?(dx: number, dy: number): void;
  /** Enter or Space. */
  onCommit?(): void;
  /** `+` or `-`, as a multiplier on the current scale. */
  onZoom?(factor: number): void;
}

const STEPS: Record<string, [number, number]> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowDown: [0, 1],
  ArrowUp: [0, -1],
};

export function bindKeys(el: HTMLElement, actions: KeyActions): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    // Never steal a shortcut. A reader holding a modifier is talking to the
    // browser, not to the figure.
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const step = STEPS[event.key];
    if (step && actions.onStep) {
      actions.onStep(step[0], step[1]);
      event.preventDefault();
      return;
    }

    if ((event.key === 'Enter' || event.key === ' ') && actions.onCommit) {
      actions.onCommit();
      event.preventDefault();
      return;
    }

    if (actions.onZoom && (event.key === '+' || event.key === '=')) {
      actions.onZoom(1.25);
      event.preventDefault();
      return;
    }
    if (actions.onZoom && (event.key === '-' || event.key === '_')) {
      actions.onZoom(1 / 1.25);
      event.preventDefault();
    }
  };

  el.addEventListener('keydown', onKeyDown);
  return () => el.removeEventListener('keydown', onKeyDown);
}
