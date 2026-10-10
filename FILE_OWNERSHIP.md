# Concurrent agent coordination
Codex owns game client core, input, rendering, physics and associated tests while working on its branch.
Claude owns backend, network protocol, database migrations and associated tests while working on its branch.
Shared documents (README/HANDOFF/PROJECT_STATE/NEXT_TASKS) require reviewing newest main before edits; prefer separate PRs and reconcile at merge. Until backend exists, Claude can prepare server scaffold on separate branch. Do not edit the same file simultaneously.
