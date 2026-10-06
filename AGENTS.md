# Project agent memory

This repo is one implementation of the [One True Shell](https://github.com/simkimsia/one-true-shell) contract.
The contract (`SPEC.md`, `VISION.md`, and the Playwright suite) lives in that repo and wins over anything here.

- Done means the conformance suite passes, not that the page looks right. Run it as the README's "Check conformance yourself" section shows, or read the `conformance` workflow.
- `schema/` is a verbatim copy of the contract's `schema/` at the spec version in `README.md`. Never edit it here; re-copy it when the spec version changes, and bump `SPEC_REF` in `.github/workflows/conformance.yml` in the same commit.
- `shell.__version__` is this implementation's version and `shell.__shell_spec__` the spec it targets; `shell/__init__.py` is their single source. Changing `__shell_spec__` means re-copying `schema/`, bumping `SPEC_REF` and the README `spec:` line, and updating the assertion in `shell/tests.py`, which checks all of them.
- Stack versions come from `shell/versions.py` at runtime. `requirements.txt` pins exact versions so CI tests what `IMPLEMENTATIONS.md` in the contract repo lists.
- `run.sh` must reset data to `schema/seed.json` and serve on `${PORT:-8000}` in the foreground.
- The suite presses keys immediately after a key that navigates (for example Escape, j, Enter). `shell.js` buffers keys during page loads and replays them; keep that path working when changing navigation.
- Anything beyond the spec uses `data-shell-x-*` attributes.

## Maintaining this file

Keep entries useful to almost every future session, point to the authoritative file instead of restating it, and prune before appending.
