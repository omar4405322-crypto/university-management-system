---
trigger: always_on
description: Extra rules for how to use graphify safely in this project. Refines graphify.md, takes priority over it when they conflict.
---

## graphify usage rules

- Use graphify (query, path, explain) for dependency, impact, and "how are X and Y connected" questions. For small questions about one or two files, read the files directly instead of calling graphify first.
- The graph only knows import-level relationships. Do not use it to claim who writes a field, who calls a specific method, or which files read another file through fs or path strings. Use `rg` (text search) for those.
- Before stating any function name or line number, verify it with `rg -n` on the source. Never state one from the graph output alone.
- In every answer, distinguish import-level dependencies from actual method calls.
- Exclude node_modules and dist from text searches.
- End every analysis with a section called "Could not verify" listing real gaps. Never claim everything was verified.
- Analysis tasks are read-only: do not edit, delete, or create project files unless I explicitly ask.
- Never run the full `/graphify .` pipeline (it sends docs and images to a model and costs tokens) without asking me first.
- In 'Could not verify', list specific claims you did not open or count (files known only from a filename list, counts from keyword matches, base paths, generated client types). Generic items like production data do not count.
