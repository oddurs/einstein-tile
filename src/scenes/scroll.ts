/**
 * Scroll as an instrument.
 *
 * Three scenes are already a function of one number — `show(step)`,
 * `show(index)`, `show(t)` — each behind a `<input type="range">`. Scroll
 * position is also one number. This module connects them.
 *
 * ## Why it drives the slider rather than the scene
 *
 * The obvious design is to call the scene's `show()` from a scroll handler.
 * This does something less obvious and much cheaper: it **writes to the range
 * input and dispatches `input`**, leaving the slider as the single source of
 * truth.
 *
 * That one choice pays for nearly everything the sprint needs:
 *
 *  - **No scene changes.** `continuum.ts` and `thehat.ts` are untouched; they
 *    still listen to their slider and cannot tell the difference.
 *  - **Keyboard still works**, because the real control is still a real range
 *    input with a real label — not a thing scroll simulates.
 *  - **Reduced motion is a one-line opt-out.** Don't attach; the slider is
 *    already the whole interface.
 *  - **No-JS is unaffected**, because none of this exists without JS.
 *
 * A reader who drags the slider directly still moves the figure; the next
 * scroll simply takes the wheel back, which is what a scrubber should do.
 *
 * ## The rules this obeys
 *
 * Scrollytelling earns its bad name by fighting the reader. So, without
 * exception: **scroll speed is never altered, `preventDefault` is never
 * called, the reader is never held in place, and a fast flick always reaches
 * the end of the piece.** The figure is a passenger of the scroll, never its
 * driver. Nothing here can trap anyone — the worst failure available is a
 * figure that does not animate.
 */

/** Progress reported to the caller, always clamped to 0…1. */
export type Progress = (p: number) => void;

export interface ScrollDriveOptions {
  /** The tall element whose travel defines 0…1. */
  readonly track: HTMLElement;
  /** The sticky child that pins while the track scrolls past. */
  readonly stage: HTMLElement;
  /** Called on every frame in which progress changed. */
  readonly onProgress: Progress;
  /**
   * Beat elements to mark as current, one per equal division of the travel.
   * Purely presentational — the argument must survive with none of them lit.
   */
  readonly beats?: readonly HTMLElement[];
  /**
   * Fractions of the travel spent held at 0 and at 1.
   *
   * Without these the figure reaches its final state at exactly the moment its
   * track ends, so the last beat — which is the one carrying each scene's
   * conclusion — appears and unpins in the same instant. The tail is the larger
   * of the two for that reason.
   *
   * Sprint 11 planned this as CSS tuning, which was wrong about where it lives:
   * `p` is `-top / travel`, so `p = 1` coincides *by construction* with the
   * stage unpinning, and no amount of track height separates them. It has to be
   * in the mapping.
   */
  readonly lead?: number;
  readonly tail?: number;
}

/**
 * Progress below which the figure is not yet driven.
 *
 * The stage pins slightly before the track's top reaches the viewport top, and
 * a reader scrolling fast should not see the figure twitch as it arrives.
 */
const EPSILON = 0.0005;

export function scrollDrive(opts: ScrollDriveOptions): () => void {
  const { track, stage, onProgress, beats = [], lead = 0.05, tail = 0.1 } = opts;
  const span = 1 - lead - tail;

  let frame = 0;
  let last = -1;
  let live = false;

  const measure = () => {
    frame = 0;
    const rect = track.getBoundingClientRect();
    // The distance the stage spends pinned: everything the track has beyond
    // the height of the thing stuck to it.
    const travel = rect.height - stage.getBoundingClientRect().height;
    if (travel <= 0) return;

    const raw = -rect.top / travel;
    // Hold at each end, so the figure settles before the first beat and the
    // conclusion stays up after the last.
    const p = Math.min(1, Math.max(0, (raw - lead) / span));
    if (Math.abs(p - last) < EPSILON) return;
    last = p;

    onProgress(p);

    if (beats.length > 0) {
      // Beats divide the travel evenly. The last beat holds through the end,
      // so the final state is readable rather than flickering at p = 1.
      const current = Math.min(beats.length - 1, Math.floor(p * beats.length));
      beats.forEach((beat, i) => {
        beat.classList.toggle('is-current', i === current);
      });
    }
  };

  const onScroll = () => {
    if (frame || !live) return;
    frame = requestAnimationFrame(measure);
  };

  // Only listen while the track is anywhere near the viewport. Five scenes all
  // measuring on every scroll event is exactly the kind of thing that makes a
  // page feel heavy, and four of them are always off screen.
  const gate = new IntersectionObserver(
    ([entry]) => {
      live = entry?.isIntersecting ?? false;
      if (live) onScroll();
    },
    { rootMargin: '50% 0px' },
  );
  gate.observe(track);

  // Passive, so the browser never waits on us to decide whether the page may
  // scroll. This is the difference between a smooth page and a janky one.
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });

  onScroll();

  return () => {
    gate.disconnect();
    removeEventListener('scroll', onScroll);
    removeEventListener('resize', onScroll);
    if (frame) cancelAnimationFrame(frame);
  };
}

/**
 * Drive a range input from a track's scroll progress.
 *
 * `snap` divides the range into that many equal states and rounds to the
 * nearest — for the discrete scenes, where a figure resting between two stages
 * reads as a bug rather than as a step. Continuous scenes leave it undefined.
 */
export function scrollDriveSlider(
  opts: Omit<ScrollDriveOptions, 'onProgress'> & {
    readonly slider: HTMLInputElement;
    readonly snap?: number;
  },
): () => void {
  const { slider, snap } = opts;

  return scrollDrive({
    ...opts,
    onProgress: (p) => {
      const min = Number(slider.min || 0);
      const max = Number(slider.max || 100);
      const t = snap ? Math.round(p * (snap - 1)) / (snap - 1) : p;
      const value = min + (max - min) * t;
      if (Number(slider.value) === value) return;
      slider.value = String(value);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    },
  });
}

/** Whether the reader has asked for less motion. */
export const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Mount = (root: HTMLElement) => () => void;

/**
 * Wrap a scene so its slider is driven by scroll.
 *
 * Composes rather than replaces: the scene mounts exactly as it always did and
 * is not told this happened. If the markup lacks a track, or the reader has
 * asked for reduced motion, the wrapper is a no-op and the slider is simply the
 * control it has always been.
 */
export function scrollDriven(mount: Mount, sliderSelector: string, snap?: number): Mount {
  return (root) => {
    const teardown = mount(root);

    const track = root.querySelector<HTMLElement>('[data-track]');
    const stage = root.querySelector<HTMLElement>('[data-sticky]');
    const slider = root.querySelector<HTMLInputElement>(sliderSelector);
    if (!track || !stage || !slider || prefersReducedMotion()) return teardown;

    const detach = scrollDriveSlider({
      track,
      stage,
      slider,
      snap,
      beats: [...root.querySelectorAll<HTMLElement>('[data-beat]')],
    });

    return () => {
      detach();
      teardown();
    };
  };
}
