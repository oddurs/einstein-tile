/**
 * Scene mounting for the narrative page.
 *
 * Every scene owns a canvas and a patch, and four live canvases on a phone is
 * how you make it crawl. So scenes mount when they come near the viewport and
 * tear down when they are well past it — `TileRenderer.destroy()` releases the
 * paths, the listeners and the resize observer.
 *
 * The margins are deliberately lopsided. Mounting starts a viewport *before* a
 * scene arrives so it is never blank when the reader reaches it; teardown waits
 * two viewports after it leaves, so scrolling back a little doesn't churn.
 */

export type SceneMount = (root: HTMLElement) => () => void;

interface Slot {
  readonly root: HTMLElement;
  readonly mount: SceneMount;
  unmount: (() => void) | null;
}

const MOUNT_MARGIN = '100% 0px';
const KEEP_MARGIN = '200% 0px';

export function mountScenes(
  registry: Record<string, SceneMount>,
  container: ParentNode = document,
): () => void {
  const slots: Slot[] = [];

  for (const root of container.querySelectorAll<HTMLElement>('[data-scene]')) {
    const mount = registry[root.dataset.scene ?? ''];
    if (mount) slots.push({ root, mount, unmount: null });
  }

  const bind = (root: HTMLElement): Slot | undefined =>
    slots.find((s) => s.root === root);

  const mountObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const slot = bind(entry.target as HTMLElement);
        if (!slot || slot.unmount) continue;
        try {
          slot.unmount = slot.mount(slot.root);
        } catch (error) {
          // One broken scene must not take the page down with it — the reader
          // should still be able to scroll past and read everything else.
          console.error(`scene "${slot.root.dataset.scene}" failed to mount`, error);
          slot.root.dataset.failed = 'true';
        }
      }
    },
    { rootMargin: MOUNT_MARGIN },
  );

  const keepObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) continue;
        const slot = bind(entry.target as HTMLElement);
        if (!slot?.unmount) continue;
        slot.unmount();
        slot.unmount = null;
      }
    },
    { rootMargin: KEEP_MARGIN },
  );

  for (const slot of slots) {
    mountObserver.observe(slot.root);
    keepObserver.observe(slot.root);
  }

  return () => {
    mountObserver.disconnect();
    keepObserver.disconnect();
    for (const slot of slots) {
      slot.unmount?.();
      slot.unmount = null;
    }
  };
}
