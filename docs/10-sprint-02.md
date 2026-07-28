# 10 — Sprint 2

## Goal

> **One page a stranger can read start to finish, and come away able to say why
> it can't repeat.**

Sprint 1 proved the two hard scenes work. It did not produce a *piece*. Today the
public URL is a developer harness with a level slider on it, and the two real
scenes are unlinked pages a reader would never find. This sprint turns working
parts into something you could post.

## Where sprint 1 actually left us

Worth being precise, because it changes what's left to build.

- **Scene 1 (periodicity) is already built.** The redesigned scene 3 opens on a
  hexagon floor that visibly clicks into alignment — that *is* the periodicity
  baseline [07](07-scope.md) asked for, delivered where it earns its keep
  instead of as a scene of its own. [07](07-scope.md) predicted scene 1 would be
  the first thing to fold; it folded.
- **Scenes 2 and 4 are nearly free.** `kites.ts` already decomposes the hat into
  its 8 kites, which is scene 2's whole content. `alignment.ts` already finds
  partial matches, which is exactly the recurrence machinery scene 4 needs.
  Neither needs new engine work.
- **Scene 5 stands.** Untouched this sprint.
- **The failure mode to avoid** is the one scene 3 hit: building an interaction
  and hoping the point emerges. Every scene here states its one sentence first,
  then earns it.

## Tickets

### N1. The narrative shell — **M** — ✅ done

`src/pages/index.astro` is the piece; `src/scenes/stage.ts` mounts scenes lazily
via two `IntersectionObserver`s with deliberately lopsided margins — mount a
viewport early so a scene is never blank on arrival, tear down two viewports
late so scrolling back doesn't churn. A scene that throws is caught and hidden
rather than taking the page down.

The dev harness moved to `/preview/` with `noindex`, and the smoke check now
asserts nothing on the piece links to it.

**The conflict worth recording: `touch-action: none` versus scrolling.** A
canvas needs it to own drag and pinch, but a full-bleed canvas would then
swallow vertical scrolling and strand a reader on a phone. The stage is
therefore capped at `62dvh` with ordinary prose above and below, so there is
always somewhere to scroll. This is why the scenes are figures in an article
rather than full-screen panels.

The smoke check was rewritten to drive the narrative page rather than the scenes
in isolation, since that is now the product. It also asserts every scene has a
standalone text takeaway.

*Original ticket text:*

One page. Scenes become sections in order, each mounting its own canvas. Scroll
is the only navigation.

Mount scenes **lazily** via `IntersectionObserver` and tear them down when far
offscreen — four live canvases each holding a patch is the obvious way to make a
phone crawl. `TileRenderer.destroy()` already exists for this.

Kill the dev harness from `/`. It moves to `/preview/`, unlisted.

**Done when:** one URL scrolls through the whole piece, and only the visible
scene holds a canvas.

---

### N2. Scene 2 — meet the hat — **S**

*One sentence: this is an ordinary shape, and you could have drawn it.*

Build the hat from its 8 kites, one at a time, on the hexagon grid the reader
just saw in scene 3's first act. Defuses "mathematicians found a magic shape"
and replaces it with "it's eight kites off a hex grid."

Uses `HAT_KITES` as-is. Ceiling per [07](07-scope.md): no Laves-tiling name, no
polykite enumeration, no coordinates on screen.

---

### N3. Scene 4 — order ≠ repetition — **M**

*One sentence: it never repeats, but it isn't random either.*

The misconception [07](07-scope.md) says must die. Tap any small patch; the app
finds and pulses **the same patch** elsewhere, and again, and again — while the
tiling still has no global repeat.

This lands hardest immediately after scene 3, where the reader has just watched
46% of tiles align and might reasonably conclude "so it nearly repeats". The
honest answer is: patches recur, the whole thing doesn't. Same fact, seen twice.

Engine: adapt `alignment.ts` — a patch recurs at shift *s* when every tile in
the selection matches under *s*, which is `alignment` restricted to a subset.

---

### N4. Scene 0 — the hook — **S**

Ambient tiling growing behind the title. No interaction, no controls. Its only
job is *"…wait, is that repeating?"* and to make the reader keep going.

Respect `prefers-reduced-motion`: render the patch, skip the growth.

---

### N5. The copy pass — **M**

The one ticket with no code. Every scene gets real prose at the register settled
in [06 §8](06-webapp-design.md) — adult, no jargon, no exclamation marks, no
mascot.

Threads to weave in, both one paragraph, neither a scene:

- **David Smith.** Retired print technician, card and scissors, found it by hand.
  Place early — it is the reason a general reader keeps going.
- **Fifty years stuck.** 20,426 tiles → 6 → 2 by 1974, then nothing until 2022.
  One sentence of stakes.

Also the closing: what it's for, and one honest line that the *why* is still
open. Then get out.

**Every scene needs a text takeaway that stands alone without its visual** —
docs/06 §4, and it is also the accessibility story.

---

### N6. Accessibility + polish pass — **M**

- Every canvas gets a real text alternative, not `alt=""`.
- Keyboard: scenes that are tap-only need a keyboard path, or an honest
  equivalent.
- `prefers-reduced-motion` honoured in each scene.
- Focus states on every control.
- One pass with a screen reader.

---

### N7. Share + open graph — **S**

An OG image generated by the engine, so the link looks like the thing. A real
`<title>` and description per the piece, not per scene.

Cheap, and it is the whole distribution mechanism ([06 §3](06-webapp-design.md)).

## Sequencing

```
N1 shell ──┬── N2 hat ──┬── N5 copy ── N6 a11y ── N7 share
           └── N3 recur ┘
                N4 hook (any time)
```

N1 first — it is the container everything else lands in. N2 and N3 are
independent. N5 needs the scenes to exist. N6 and N7 are last.

## Explicitly not in this sprint

Scene 6 (the spectre), scene 7 (the continuum), the sandbox, export, WebGL,
localization. [07](07-scope.md) calls 6 and 7 enrichment, and the arc is complete
without them — which is exactly the test of whether the scope doc meant it.

## Definition of done

1. One URL, readable start to finish, on a phone.
2. No developer surface reachable from it.
3. A stranger who reads it can say, unprompted, roughly *why* it can't repeat.
4. The link looks like something when posted.
