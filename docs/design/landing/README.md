# The landing page design, as approved

This branch exists to keep one file reachable: `Plinto Landing.dc.html`, the
landing page design as it was approved in Claude Design, together with the two
photographs it uses.

It is an orphan branch with a single commit and no shared history. Nothing here
is built, tested or shipped, and it is deliberately not merged into `develop`.

## Why it is not on `develop`

The `.dc.html` is not a standalone page. It expects three scripts that belong to
Claude Design — a `{{ }}` and `sc-for` template engine, an image-slot helper and
a design-system bundle — none of which are in this repository. Opening the file
in a browser shows raw template syntax, so committing it to the trunk would put
a 97 KB artifact there that nobody can open and that no test covers.

It was committed to `develop` once and reverted for exactly that reason.

## Why it is kept at all

It is the source of truth for what the landing was supposed to look like. The
port in `apps/landing` was built from this file: its markup, its 121 lines of
CSS and its bilingual copy dictionary. When a question comes up about why a
section is laid out the way it is, the answer is here.

Recover it with:

    git show design/landing-artifact:"docs/design/landing/Plinto Landing.dc.html" > landing.dc.html

## Contents

| File | What it is |
|------|------------|
| `Plinto Landing.dc.html` | The approved design: markup, inline styles, internal CSS and the `COPY` dictionary for Spanish and English |
| `assets/photo-planilla-mesa.jpg` | `photo_1` — the kitchen table with the printed spreadsheet |
| `assets/photo-familia-mesa.jpg` | `photo_2` — a real home in daylight |
