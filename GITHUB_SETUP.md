# GitHub setup
Create a new GitHub repository named `nightshift-city-online` (private recommended), without initializing a README. Extract the ZIP and run from inside `nightshift-city-online`:

```bash
git init
git add .
git commit -m "Initial Nightshift City v0.2 playable prototype"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nightshift-city-online.git
git push -u origin main
```

For Claude and Codex, give each its own branch (`claude/...` and `codex/...`). Require handoff file updates and tests with every completed task. The repo is separate from Nightshift Garage.
