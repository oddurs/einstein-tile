# 18 — Sprint 9

## Theme: the piece as a document

> **LaTeX is a system for making documents. The piece has never been one.**

## Why this, now

Sprint 8 took the craft of TeX's *setting*. This takes the rest of the idea:
that the thing should exist on paper, and be worth keeping there.

Measured before planning:

| | |
| --- | --- |
| `@media print` rules | **0** |
| canvases that would print as rasters | 6 |
| interactive controls that would print | 7 |
| HUD panels that would print | 5 |

So today it prints as a web page photographed badly: buttons and sliders frozen
mid-interaction, figures at screen resolution, and no acknowledgement that paper
has pages.

**The move that makes this worth doing** is that the engine already emits exact
polygons, and already knows how to write SVG — `toSVG` was built for the
sandbox. A printed figure can therefore be *vector*, sharp at any size, which is
precisely what a LaTeX figure is and what a rasterised canvas can never be.

## Tickets

### P1. A print stylesheet — **M**

Hide what cannot be used on paper: sliders, buttons, the hook's animation, the
scroll affordances. Keep the argument — prose, figures, takeaways.

Set the page properly. Physical units for the measure, since `ch` is right for
screens and points are right for paper. Margins that leave room for a thumb.
Avoid breaking a figure from its caption.

---

### P2. Figures as vector — **M**

Give the renderer a `toSVG()` that emits exactly what it last drew, from the
figure data it already retains, and swap each canvas for its SVG when printing.

Not a screenshot: the same exact coordinates the screen version uses, at
whatever resolution the paper has.

---

### P3. The document's furniture — **S**

A printed page has to say what it is and where it came from, because it has no
address bar: a title block, the source URL, the date, and the credit to the four
authors. Small, and the difference between a printout and a document.

---

### P4. Look at the PDF — **S**

Render it and read it. Page count, orphans, figures that land badly, anything
that breaks across a page.

The screenshot harness's lesson applies: this is only verified at the sizes
actually checked, so check A4 *and* Letter.

## Not in this sprint

Anything that changes the screen experience. If a print rule leaks into the
screen stylesheet, that is a bug, and the screenshot diff should catch it.

## Definition of done

1. Printing produces a document, not a photographed web page.
2. Every figure is vector.
3. The screen rendering is pixel-identical to before.
