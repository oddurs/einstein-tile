/**
 * The two things every scene does.
 *
 * Seven scenes each opened by binding their elements with a hand-written guard
 * and wiring up `matchMedia('(prefers-color-scheme: dark)')`. Seven copies of
 * the same eight lines is where the next selector collision comes from — this
 * project has already shipped one of those.
 *
 * Deliberately small. Scenes should still read as themselves, only shorter; a
 * framework here would cost more than the duplication did.
 */

export type Theme = 'light' | 'dark';

/**
 * Bind required elements, or fail loudly naming what is missing.
 *
 * The previous per-scene guards threw "missing required elements" without
 * saying which, so a typo in a `data-` attribute meant reading the markup to
 * find out. This says.
 */
export function bind<K extends string>(
  root: ParentNode,
  selectors: Record<K, string>,
  label: string,
): Record<K, HTMLElement> {
  const found = {} as Record<K, HTMLElement>;
  const missing: string[] = [];
  for (const [key, selector] of Object.entries(selectors) as [K, string][]) {
    const el = root.querySelector<HTMLElement>(selector);
    if (el) found[key] = el;
    else missing.push(`${key} (${selector})`);
  }
  if (missing.length) {
    throw new Error(`${label}: missing ${missing.join(', ')}`);
  }
  return found;
}

export interface ThemeWatcher {
  readonly current: Theme;
  readonly dark: boolean;
  /** Call on teardown. */
  stop(): void;
}

/** Track the reader's colour scheme, and run `onChange` when it flips. */
export function watchTheme(onChange: (theme: Theme) => void): ThemeWatcher {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => onChange(media.matches ? 'dark' : 'light');
  media.addEventListener('change', handler);
  return {
    get current(): Theme {
      return media.matches ? 'dark' : 'light';
    },
    get dark(): boolean {
      return media.matches;
    },
    stop: () => media.removeEventListener('change', handler),
  };
}

/**
 * Collect teardown steps so a scene's cleanup cannot drift from its setup.
 *
 * The old pattern listed every `removeEventListener` again at the bottom of the
 * function, which is two lists that have to agree — and the kind that quietly
 * stops agreeing.
 */
export function teardown(): {
  add(fn: () => void): void;
  on<T extends EventTarget>(target: T, type: string, fn: EventListener): void;
  run(): () => void;
} {
  const steps: (() => void)[] = [];
  return {
    add: (fn) => void steps.push(fn),
    on(target, type, fn) {
      target.addEventListener(type, fn);
      steps.push(() => target.removeEventListener(type, fn));
    },
    run() {
      return () => {
        for (const step of steps.reverse()) step();
        steps.length = 0;
      };
    },
  };
}
