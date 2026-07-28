# References

Compiled 2026-07-27. Annotated; read the two primary papers first.

## Primary papers

- **An aperiodic monotile** — David Smith, Joseph Samuel Myers, Craig S. Kaplan,
  Chaim Goodman-Strauss. [arXiv:2303.10798](https://arxiv.org/abs/2303.10798),
  submitted 20 Mar 2023, revised 3 Jul 2024. Published *Combinatorial Theory*
  4(1) #6 (2024).
  The hat, the `Tile(a,b)` continuum, the H/T/P/F metatiles, both proofs.

- **A chiral aperiodic monotile** — same authors.
  [arXiv:2305.17743](https://arxiv.org/abs/2305.17743), submitted 28 May 2023.
  Published *Combinatorial Theory* 4(2) #13 (2024).
  `Tile(1,1)`, weak vs strict chirality, Spectres and Mystics.
  Author copy: [strauss.hosted.uark.edu](https://strauss.hosted.uark.edu/distribution/papers/spectre.pdf).

## Authors' own pages — start here for figures and software

- [The hat — cs.uwaterloo.ca/~csk/hat](https://cs.uwaterloo.ca/~csk/hat/) —
  interactive apps, SVGs, proof-validation code. Images CC BY 4.0.
- [The spectre — cs.uwaterloo.ca/~csk/spectre](https://cs.uwaterloo.ca/~csk/spectre/) —
  patch builder, spectre SVG, hat↔turtle↔spectre animation.
- [Kaplan, *Aperiodic Monotiles* — isohedral.ca](https://isohedral.ca/aperiodic-monotiles/) —
  first-person account of the discovery. The single best short read.

## Code

- [isohedral/hatviz](https://github.com/isohedral/hatviz) — p5.js, BSD-3. Reference implementation.
- [isohedral/hatvalidate](https://github.com/isohedral/hatvalidate) — Python, verifies the computer-assisted proof.
- [isohedral/tactile-js](https://github.com/isohedral/tactile-js) — general periodic-tiling library.
- [christianp/aperiodic-monotile](https://github.com/christianp/aperiodic-monotile) — the shapes in many formats.
- [kerupani129s/spectre-monotile-js](https://kerupani129s.github.io/spectre-monotile-js/) — JS spectre generator.

## Algorithms

- Simon Tatham, [**Combinatorial coordinates for the aperiodic Spectre tiling**](https://www.chiark.greenend.org.uk/~sgtatham/quasiblog/aperiodic-spectre/) —
  the best implementation guide available. Exact, lazy, no floating point.
- Simon Tatham, [Two algorithms for randomly generating aperiodic tilings](https://www.chiark.greenend.org.uk/~sgtatham/quasiblog/aperiodic-tilings/).
- [Direct Construction of Aperiodic Tilings with the Hat Monotile](https://arxiv.org/html/2306.06512) — arXiv:2306.06512.

## Mathematics since

- [Planar aperiodic tile sets: from Wang tiles to the Hat and Spectre monotiles](https://arxiv.org/pdf/2310.06759) — arXiv:2310.06759. Survey; best for context.
- [On the long-range order of the Spectre tilings](https://arxiv.org/pdf/2411.15503) — arXiv:2411.15503; *Discrete & Comput. Geom.* (2025).
- [Homochiral inflation for the aperiodic monotile Tile(1,1)](https://arxiv.org/pdf/2502.15608) — arXiv:2502.15608.
- [Dynamics and topology of the Hat family of tilings](https://arxiv.org/html/2305.05639) — arXiv:2305.05639.
- [Turtles, Hats and Spectres: Aperiodic structures on a Rhombic tiling](https://arxiv.org/pdf/2403.01911) — arXiv:2403.01911.
- [Aperiodic monotiles: from geometry to groups](https://arxiv.org/pdf/2409.15880) — arXiv:2409.15880.
- [An alternative proof for an aperiodic monotile](https://arxiv.org/html/2307.12322) — arXiv:2307.12322.
- [Proof of aperiodicity of hat tile using the golden ratio](https://arxiv.org/pdf/2403.09640) — arXiv:2403.09640.
- [A construction of the hat tilings by a Markov partition](https://arxiv.org/pdf/2604.20964) — arXiv:2604.20964.
- [Finite-state transducers for substitution tilings](https://arxiv.org/pdf/2512.16595) — arXiv:2512.16595.

## Physics and applications

- [Quasicrystalline structure of the Hat monotile tilings](https://arxiv.org/html/2305.01174) — arXiv:2305.01174; *Phys. Rev. B* 108, 224109.
- [Ising model on the aperiodic Smith hat](https://arxiv.org/pdf/2402.11331) — arXiv:2402.11331.
- [Quasilattices of the Spectre monotile](https://arxiv.org/pdf/2502.06926) — arXiv:2502.06926.
- [Observation of an aperiodic polariton monotile](https://arxiv.org/html/2605.13206) — arXiv:2605.13206 (2026, experimental).
- [Critical states and anomalous wave transport in an aperiodic polariton monotile](https://arxiv.org/pdf/2605.29023) — arXiv:2605.29023.
- [Quantum error-correcting codes from aperiodic monotiles: the Hat and the Spectre](https://arxiv.org/html/2607.15326) — arXiv:2607.15326.
- [Beating the aliasing limit with aperiodic monotile arrays](https://arxiv.org/pdf/2408.16476) — arXiv:2408.16476.

## Popular coverage

- [Inside Mathematicians' Search for the Mysterious 'Einstein Tile' — *Scientific American*](https://www.scientificamerican.com/article/inside-mathematicians-search-for-the-mysterious-einstein-tile/)
- [Mathematicians have finally discovered an elusive 'einstein' tile — *Science News*](https://www.sciencenews.org/article/mathematicians-discovered-einstein-tile)
- [Now that's what I call an aperiodic monotile! — *The Aperiodical*](https://aperiodical.com/2023/05/now-thats-what-i-call-an-aperiodic-monotile/)
- [The Hat and the Spectre — National Museum of Mathematics](https://momath.org/the-hat/)
- [A tip of the hat — Cambridge Faculty of Mathematics](https://www.maths.cam.ac.uk/features/tip-hat-celebrating-aperiodic-monotile-discovery)
- [Solving the perplexing mathematicians' problem of the spectre — OpenLearn](https://www.open.edu/openlearn/solving-the-spectre)
- David Smith's own blog, [hedraweb](https://hedraweb.wordpress.com/) — e.g.
  [*The Special One*](https://hedraweb.wordpress.com/2023/06/02/the-special-one/).

## Design & pedagogy (for [06-webapp-design.md](06-webapp-design.md))

- Nicky Case, [**Explorable Explanations**](https://blog.ncase.me/explorable-explanations/) —
  Do & Show & Tell, interest curves, cognitive gates, "not gamification". The core text.
- Bret Victor, [Explorable Explanations](https://worrydream.com/ExplorableExplanations/) —
  originated the term; the guide-attention-vs-pile-of-widgets distinction.
- The Pudding, [**Responsive scrollytelling best practices**](https://pudding.cool/process/responsive-scrollytelling/) —
  the `vh` trap, hover removal, stepper anti-pattern, mobile pacing.
- [Bartosz Ciechanowski](https://ciechanow.ski/) — the craft bar. Canvas early, WebGL later; every figure custom.
- [awesome-explorables](https://github.com/blob42/awesome-explorables) and
  [awesome-explanations](https://github.com/BHSPitMonkey/awesome-explanations) — prior-art surveys.
- [Touching Data: discoverability of touch visualization interfaces](https://arxiv.org/pdf/1806.06084) —
  why precise-positioning gestures fail on dense visualizations.
- [ChartA11y: accessible touch visualization](https://arxiv.org/pdf/2410.20545) — touch a11y patterns.
- [Mathigon Polypad](https://mathigon.org/polypad) — existing hat sandbox (Dan Anderson's build).

## Reference

- [Einstein problem — Wikipedia](https://en.wikipedia.org/wiki/Einstein_problem)
- [Socolar–Taylor tile — Wikipedia](https://en.wikipedia.org/wiki/Socolar%E2%80%93Taylor_tile)

## Caveats on secondary sources

Popular coverage is unreliable on two points:

1. The **reflection ratio**. The correct figure is φ⁴ ≈ 6.8541 unreflected per
   reflected hat, i.e. a reflected density of 1/(φ⁴+1) ≈ 0.127. "One in six" and
   "1 : 7.53" both circulate and are wrong.
2. **Edge count**. The hat is a 13-gon as a simple polygon, but has 14 edges in the
   `Tile(a,b)` parameterization (one vertex is a straight 180°). Both "13-sided"
   and "14-sided" appear in reputable sources, describing the same shape.
