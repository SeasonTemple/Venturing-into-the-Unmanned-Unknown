# Repository instructions

## Mandatory anonymous identity and privacy discipline

- Every commit author AND committer must be `SeasonTemple <46681958+SeasonTemple@users.noreply.github.com>`. Never inherit a global real name or work email. This applies to commits, amend, merge, cherry-pick, rebase, release tags and automation.
- Before committing run `git var GIT_AUTHOR_IDENT`, `git var GIT_COMMITTER_IDENT` and `python scripts/check-commit-privacy.py --staged`. A mismatch blocks the commit; do not bypass hooks.
- Use repository-local identity settings and `core.hooksPath=.githooks`. After cloning configure them explicitly. `user.useConfigOnly=true` is additional protection, not a substitute for checking resolved identities.
- Public content, logs, generated manifests and discussion packages must not contain personal names/emails, local account home paths, internal proxy addresses or credentials. Use repository-relative paths and placeholders. Keep raw diagnostic evidence outside tracked/public artifacts.
- Before pushing run `python scripts/check-commit-privacy.py` and `python scripts/check-commit-privacy.py --history`; inspect the diff. The pre-push hook repeats these checks.
- If private data is found, stop publishing, preserve unrelated work and report the scope. A new commit does not erase leaked history. Remote history rewriting requires explicit user authorization.
- Never claim remote caches, pull-request refs or existing clones were erased merely because branches/tags were rewritten.

## Existing production gate

`load-sequence-v01` is withdrawn. Until the complete static character passes review, do not generate action frames/videos or integrate the character into the homepage. Preserve the user's confirmation that the current static baseline's limbs and overall anatomy look normal and complete.

## Mandatory repository hygiene

- Experimental outputs, rejected candidates, intermediate models/renders, extracted frames, contact sheets, preview recordings, raw tool logs and local dependencies MUST stay ignored and MUST NOT enter Git history. Reproducibility is not a reason to commit them.
- Use `.scratch/` or `.lab/` for temporary work. Large research archives belong outside this repository; keep only a concise conclusion, provenance and archive index in Git.
- Keep necessary source code, production assets and the explicitly retained current baseline/source. The baseline is retained evidence, not an art approval. Every retained binary must have an exact path and purpose in `config/repository-assets.json`.
- Never use `git add .`, `git add -A` or `git add -f` to sweep experiments into a commit. Stage an explicit reviewed file list. Do not edit the asset register merely to make a rejected output pass checks.
- Before committing run `python scripts/check-repository-hygiene.py --staged`; before pushing run it without flags and with `--history`. Hooks and CI must enforce these checks. Do not bypass them.
- Default maximum file size is 2 MiB; the current tracked tree and unique reachable blob storage each have a 25 MiB budget. A genuine larger production source requires the user's explicit decision about storage; do not silently raise budgets, add exceptions, or use LFS to hide an uncontrolled asset dump.
- `.gitignore` does not untrack existing files or remove history. When cleanup is authorized, archive unique evidence locally with hashes, remove retired tracked outputs, and verify a fresh full clone. Keep unrelated uncommitted work intact.
