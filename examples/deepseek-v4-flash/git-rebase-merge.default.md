# Git Rebase vs. Git Merge

Both commands integrate changes from one branch into another, but they do it in fundamentally different ways — and they produce very different commit histories.

## The core difference

**`git merge`** creates a new "merge commit" that joins two histories together. The original branch commits stay exactly as they were, and the merge commit has two parents.

```
        A---B---C  feature
       /         \
  D---E---F-------M  main (M = merge commit)
```

**`git rebase`** takes the commits from your feature branch and *replays them on top of* the target branch, rewriting them with new timestamps/hashes. No merge commit is created — the history becomes linear.

```
                A'--B'--C'  feature (rewritten)
               /
  D---E---F---G  main
```

Notice the feature commits are now `A'`, `B'`, `C'` — they're new commits, even if the code changes are identical.

## What each is good for

### Use `git merge` when:

- **You're working on a shared/long-lived branch** (e.g., `main`, `develop`). Merging preserves history, and other people's local copies won't break.
- **You want to preserve the true story** of *when* work happened in parallel.
- **You're bringing a feature branch into main** and want an explicit record that a feature was integrated as a unit. This is the default behavior of GitHub's "Merge pull request" button.
- **You want to abort safely.** A merge is a single operation — if something goes wrong, you can `git merge --abort` with no side effects.

### Use `git rebase` when:

- **You're cleaning up your own unpushed local commits.** The classic workflow: while working on a feature, you regularly run `git rebase main` to pull in the latest changes, keeping your branch up to date without creating a noisy web of merge commits.
- **You want a clean, linear history** for readability. Linear histories are much easier to `git bisect`, `git log`, and review.
- **You're doing an "interactive rebase"** (`git rebase -i`) to squash, reorder, or reword commits before sharing them.
- **History rewrite is explicitly desired**, e.g., during a PR review where the maintainer asks you to fix up commits and squash them.

## The golden rule

> **Never rebase commits that others have based work on.**

Rebasing rewrites history. If someone else has already pulled your branch and then you rebase it, their local copy and your remote copy have diverged — the next time they pull, Git will see two different histories and they'll have to deal with duplicate commits or forced-push fallout. Merging is always safe for shared branches. Rebase is safe only on branches that are *yours alone* (typically: local feature branches that haven't been pushed, or a PR branch you're actively revising with no other contributors).

## Tradeoffs at a glance

| | Merge | Rebase |
|---|---|---|
| History | Preserves full context, shows parallel work | Linear, clean, easy to read |
| Commit timestamps/hashes | Untouched | Rewritten (new hashes) |
| Noise | Creates merge commits, can get tangled | No merge commits, but loses "when work really happened" |
| Safety on shared branches | ✅ Safe | ❌ Dangerous |
| Conflict handling | One conflict resolution at the merge point | Must resolve the same conflict *per commit* being replayed (often repeatedly) |
| Reversibility | Easy to undo (`git revert` the merge) | Harder — rewriting means redo/force-push |

## A practical, common workflow

Combine both for the best of each:

1. While developing your feature, **rebase** on `main` periodically to stay current and keep your branch clean.
2. Use `git rebase -i` to squash and polish your commits before pushing.
3. When the feature is done, **merge** it into `main` — often with `--no-ff` to force an explicit merge commit that records the feature as a unit.

## Summary

- **Merge = "preserve history as it happened."** Use it on shared branches and when you want a permanent record of integration.
- **Rebase = "rewrite history as you wish it had happened."** Use it on your own unpushed work for a clean linear story.
- The one hard rule: **shared history gets merged, private history gets rebased.**

If your team uses a tool like GitHub, the settings on the "Merge pull request" button effectively let each PR choose its strategy — squash-and-merge and rebase-and-merge are the popular defaults because they keep `main` linear while still letting developers work freely on feature branches.
