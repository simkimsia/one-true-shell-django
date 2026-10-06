# Contributing

Thanks for wanting to contribute.
One rule up front:

**Human-authored pull requests targeting `main` must be raised through [`no-mistakes`](https://github.com/kunchenguid/no-mistakes).**
It is the same rule the [contract repo](https://github.com/simkimsia/one-true-shell/blob/main/CONTRIBUTING.md) and [kunchenguid/axi](https://github.com/kunchenguid/axi/blob/main/CONTRIBUTING.md) use.

A GitHub Actions check (`Require no-mistakes`) fails PRs whose body lacks the signature and pipeline attestation that no-mistakes writes.
Bot accounts are exempt.

## Workflow

1. Fork the repo, then clone the parent repo or set your local `origin` back to it (`git@github.com:simkimsia/one-true-shell-django.git`).
2. Create a branch and make your changes.
3. Initialize the gate with your fork as the push target: `no-mistakes init --fork-url git@github.com:<you>/one-true-shell-django.git`.
4. Commit, then push through the gate with `git push no-mistakes` and run `no-mistakes` to watch the pipeline.
5. Once it passes, it pushes to your fork and opens the PR for you.

## Before you push

Both checks CI runs must pass locally:

```sh
python manage.py test shell
git clone --branch v0.2.0 https://github.com/simkimsia/one-true-shell /tmp/one-true-shell
(cd /tmp/one-true-shell/conformance && npm ci && npx playwright install chromium && IMPL_DIR="$OLDPWD" npx playwright test)
```

Behavior changes must keep all conformance tests passing. Version bumps follow [AGENTS.md](AGENTS.md).
