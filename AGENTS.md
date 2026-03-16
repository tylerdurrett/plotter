AGENTS.md should be VERY concise because it goes into every context, and it should have just enough to keep the agent in line and productive.

## UI Conventions

Key UI rules:

- Dark-theme-first. Only animate `transform`/`opacity`.

## Development Workflow

Small changes are one-offs. Larger features use `_tasks/` with status folders: `_ideas`, `_planning`, `_ready-to-start`, `_in-progress`, `_complete`, `_icebox`, `_abandoned`. Move the feature folder between status folders as work progresses. See `docs/dev-cycle.md`.

## Remember

- Never edit files ending in .human.md. Those were created by a person and should stay that way.
- Always create tests for your code
- When you fix a bug, add a comment documenting why you're updating the code so we prevent regressions.
- Never run `pnpm build` while the dev server is running — it overwrites the `.next` directory and causes internal server errors / broken CSS. To type-check without affecting the dev server, use `pnpm --filter @repo/web tsc --noEmit`.
- When doing UI work, visually test your code using the chrome devtools skill
- Do as much as possible to verify your work yourself without asking the user
- Strive to create minimal code! Be pragmatic. We do not want to overengineer. Our focus is on creating exactly the functionality we need, and keeping the code footprint as small as possible.
- Security is always important.
- Always update docs when you are finished
- Always run the code review when you're done implementing a plan
