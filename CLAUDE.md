# misc

A catch-all repo for unrelated one-off projects. Each top-level folder is an
independent project with its own README.

## Working here

- **Treat each project as standalone.** When starting a new project, create a new
  top-level folder and build it from scratch for its own goals. Don't copy code,
  structure, tooling, or style from sibling folders unless the user asks for it
  (e.g. "do it like multiverse").
- **Stay inside the current project's folder.** Don't read, search, or edit other
  project folders unless the task calls for it. Scope greps and globs to the
  project's folder, not the repo root.
- **No shared code between projects.** If something is reusable, duplicate it into
  the new project rather than importing across folders.
- **Each project gets a README** that explains what it is and how to build or run it.
- **Commits touch one project at a time** and the message should make clear which
  project it's for.

## Large files

Rendered outputs and source media (video, audio, image sequences) make the repo
heavy for every clone. Prefer committing the sources and scripts needed to
rebuild an output over committing large binaries, and ask before adding media
files over ~20 MB.
