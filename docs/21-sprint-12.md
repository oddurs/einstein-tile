# 21 — Sprint 12

## Theme: five visual languages, and every conclusion said twice

> **The engine is exact, the palette is validated, and then each scene invented
> its own colours anyway.**

## The verdict, first

**Two tickets are backed by hard numbers and are worth doing on their own.** The
rest are craft. Nothing here is a rewrite — the piece works; it is inconsistent
in ways that are individually invisible and collectively cheapening.

## Measured before planning

### Four scenes, four different greys for the same idea

Every scene draws "a tile that is not currently the point" in its own colour:

| scene | light | dark |
| --- | --- | --- |
| hat | `#dde3e8` | `#2c343d` |
| repeat | `#ccd3da` | `#38414d` |
| recurrence | `#d3d9de` | `#333c46` |
| hierarchy | `#aab6bf` | `#4a5c68` |

Four neutrals for one semantic role, none of them equal, none of them from
`palette.ts` — **the module whose entire purpose is that colour decisions are
validated rather than guessed.** Alongside them, **14 one-off `rgba()` inks**
for grid lines, ghosts, highlights and outlines, and **five different stroke
widths** (1, 1.2, 1.4, 1.5, 1.6) with no rule distinguishing them.

Each was a reasonable local choice. Together they are why the scenes look like
five programs rather than one piece — and every one of them is doubled, because
each carries its own hand-written dark variant.

### The last beat and the takeaway say the same thing

Sprint 10 gave every scroll scene beats. The takeaways were written earlier,
when a takeaway was *all a reader without JavaScript got* and therefore had to
carry the scene alone. Both now appear, one immediately after the other:

**hierarchy** — the conclusion of the whole piece, delivered twice in a row:

> *last beat:* It never stops — so there is no block you could stamp out, at any
> size. **That is why it can never repeat.**
>
> *takeaway:* …This has no such block at any size — **which is exactly why it can
> never repeat.**

**hat:**

> *last beat:* …and that is the whole shape. Nothing exotic: **eight kites off a
> hexagon floor.**
>
> *takeaway:* The hat is **eight kites cut from a hexagon floor** — a
> thirteen-sided polygon with no unusual angles…

The piece lands its biggest moment and then immediately explains the landing.
**That is not emphasis, it is deflation** — and it is a direct, unnoticed cost
of adding beats without revisiting what was already there.

### The prose grew and the README did not

| | |
| --- | --- |
| words, sprint 9 | 719 |
| words now | **874** |
| reading time | ≈3.8 min |
| README claims | "about three minutes" |

Per scene, the two hands-on scenes are now the thin ones:

| scene | prose | beats | takeaway | total |
| --- | --- | --- | --- | --- |
| hat | 79 | 36 | 35 | 150 |
| repeat | 68 | — | 37 | **105** |
| recurrence | 54 | — | 43 | **97** |
| hierarchy | 36 | 64 | 48 | 148 |
| continuum | 49 | 60 | 57 | 166 |

### The colour arc exists, but nobody chose it

A reader currently passes through: a **12-colour** hook, then three scenes that
are **mostly grey**, then a **4-colour** hierarchy, then a **12-colour**
continuum. That is not a bad shape — colour returning for the climax is exactly
right — but it is a by-product of each scene picking colours independently, not
a decision. Anything not decided cannot be relied on.

## Tickets

### S1. One ink, not four — **M**

Give `palette.ts` the roles the scenes are already using, and delete the local
definitions:

- `inactive` — a tile that is not the point right now
- `grid` — construction lines the reader should see through
- `ghost` — a moved or overlaid copy
- `landed` / `missed` — the two outcomes in `repeat`
- `outline` — a hull or boundary

Plus a stroke scale, so 1.4 versus 1.5 is a choice rather than an accident.

**Validate them.** The project already has CVD tooling and an OKLab ΔE
measurement; the ink roles have never been through it, and `landed` versus
`missed` is precisely the pair where colour-blind separation matters most —
it is the one place the piece asks a reader to tell two states apart *by
colour alone*.

---

### S2. Stop saying it twice — **M**

Beats and takeaways must do different jobs:

- **Beats narrate.** They are read while the figure moves and should carry only
  what is on screen right now.
- **Takeaways consolidate.** They should say what the reader now knows that they
  did not before — the thing the beats *earned*, not a summary of them.

Constraint that makes this rewriting rather than deleting: **without JavaScript
the takeaways are still the entire argument.** The no-JS word count must not
fall, and `npm run verify` already asserts it.

Special care for hierarchy. It carries the piece's conclusion, and the current
arrangement fires it twice. Say it **once**, in the strongest of the two places,
and let the other do something else.

---

### S3. Choose the colour arc — **S**

Make the accidental shape deliberate and write it down: **colour is information,
and it is spent where the argument needs it.** The grey middle is correct — those
scenes are about position and motion, not identity — and the return of colour at
the hierarchy should read as the argument arriving.

Small work; mostly a decision plus a paragraph in `docs/06`. Its value is that
the next scene added to the piece has a rule to follow.

---

### S4. The ending needs a picture — **S**

The outro is **163 words of unbroken prose** immediately after the most visual
scene in the piece, and it contains the best line in the whole thing — *"What
nobody has is a reason… It still doesn't."*

That line deserves better than being the fourth paragraph of a colophon. The
spectre is also named here and never shown, which is the one place the piece
mentions something it does not let you look at.

---

### S5. Beats that ask, not only tell — **M**

The hat's beats are stage directions: *"Cut each hexagon into six kites."* They
describe what is happening, which the reader can already see.

The strongest beat in the piece is hierarchy's last, because it does something
different — it draws a conclusion the picture alone does not give you. That is
the standard the others should meet: **say the thing the figure cannot.**

Lowest confidence ticket in the sprint. Rewrite them, read them, and keep the
originals where the rewrite is not plainly better.

---

### S6. Make S1 stick — **S**

A test that fails when a scene hardcodes a colour: no hex literals, no `rgba()`,
outside `palette.ts` and `tokens.ts`.

Without this, S1 lasts exactly until the next scene is written — which is the
whole reason four greys exist. The rule has to outlive the sprint that noticed
it, and only a check does that.

Also: correct the README's "about three minutes" to what the measurement says.

## Not in this sprint

- **Anything structural.** No new scenes, no reordering, no changes to
  `scroll.ts` or the sticky layout — all three were measured healthy in sprint
  11 and none is what makes the piece feel uneven.
- **A design system.** Six semantic ink roles is not a system and should not
  grow into one.

## Definition of done

1. No scene defines a colour. A check fails if one does.
2. The ink roles are CVD-validated, `landed`/`missed` especially.
3. No conclusion is stated twice in a row; the no-JS word count has not fallen.
4. The colour arc is written down as a rule, not a description.
5. The README's reading time matches the measurement.
