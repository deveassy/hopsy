# Development Workflow

- Create a task-specific branch from the latest main before starting new work.
- Use lowercase kebab-case branch names with prefixes: feat/, fix/, chore/, refactor/, docs/, or test/.
- Follow existing project conventions and keep changes focused.
- Run applicable builds, type checks, linting, and tests after implementation.
- If validation fails, fix the issues and rerun checks. Report unresolved failures without creating a PR.
- Stage only relevant files and use Conventional Commits.
- Push the branch and create a Draft PR targeting main.
- Include a summary, validation results, and manual testing steps in the PR.
- Apply revisions to the existing branch and PR.
- Never push directly to main or merge without explicit approval.
