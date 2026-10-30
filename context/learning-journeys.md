# Learning journey section coverage

What each learning journey covers, section by section. The level is what
`journey_section.coverageLevel` stores and what drives recommendations
(`assessment.path.ts` picks the best M, then R, then S match) and a
journey's own self-assessment (`assessDisabled`/"Assess this journey" only
asks the sections it has at least an M in).

- **M - Core.** The journey's central focus; a journey assessment asks these sections.
- **R - Recommended.** Reinforces the core but isn't assessed on its own.
- **S - Selective.** Touches the section, but only lightly.

| Section                                                   | Athena | Hephaestus | Apollo | Prometheus | Themis |
| ---------------------------------------------------------- | :----: | :--------: | :----: | :--------: | :----: |
| A - Open Science Fundamentals                              |   M    |     M      |   M    |     M      |   M    |
| B - Open Science Resources, Repositories and Data Workflows |   M    |     R      |   M    |     M      |   S    |
| C - Management Literacy and Implementation Planning         |   M    |     R      |   S    |     M      |   M    |
| D - Legal and Ethical Open Science Curriculum                |   M    |     M      |   R    |     M      |   R    |
| E - Applied Open Science in Educational Contexts             |   R    |     M      |   R    |     R      |   R    |

Source data: `database/src/seed/data/aios_wp2_seed.json`,
`aios.learningJourney.journey_section`.

Apollo's row (A=M, B=M, C=S, D=R, E=R) is a provisional best-effort guess,
not sourced from an exact module list like the other four — see the comment
above `wp2Dataset` in `database/src/seed/wp2Seed.ts`. Correct it once the
real WP3 curriculum journey table is available.
