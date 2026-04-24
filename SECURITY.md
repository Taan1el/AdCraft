# Secret Safety

`gitignore` is not complete protection against secret leaks.

It only helps prevent accidental staging of matching files. It does not protect you if:

- a key is pasted directly into source code
- a secret is committed before the ignore rule exists
- a file is force-added with `git add -f`
- a key appears in logs, screenshots, recordings, or copied terminal output
- a build artifact or generated file contains a secret

## Rules for this repo

- Keep real API keys in local `.env` files only
- Commit `.env.example`, never `.env`
- Never expose secrets through frontend variables such as `NEXT_PUBLIC_*`
- Route model/API calls through the backend
- Rotate any key that has ever been pasted into chat, committed, or shared

## Before pushing

1. Check staged files with `git diff --cached`
2. Search for obvious secret patterns with `git grep -n "API_KEY\\|SECRET\\|TOKEN"`
3. Run a secret scanner such as `gitleaks` if available

If a secret ever reaches Git history, deleting the latest file is not enough. Rotate the key and rewrite the history.
