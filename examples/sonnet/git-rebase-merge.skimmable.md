**Rebase rewrites history; merge preserves it.**

## git merge

Combines branches with a new merge commit.

```
A---B---C  main
     \   \
      D---E  merge commit
```

- **Pros**
  - Non-destructive — original commits untouched
  - Preserves true history (what actually happened, when)
  - Safe on shared/public branches
- **Cons**
  - Merge commits clutter history
  - Log graph gets messy with many branches

## git rebase

Replays your commits on top of another branch, rewriting them.

```
Before:  A---B---C  main
              \
               D---E  feature

After:   A---B---C---D'---E'  feature (rebased)
```

- **Pros**
  - Linear, clean history
  - Easier `git bisect`, easier to read log
- **Cons**
  - Rewrites commit hashes — **never rebase shared/pushed branches** others rely on
  - Force-push required after rebasing (`git push --force-with-lease`)
  - Conflict resolution can repeat per-commit (vs. once with merge)

## When to use each

- **Rebase** — cleaning up your own local feature branch before opening a PR
  - `git rebase main` to catch up with latest changes, then push
- **Merge** — integrating a finished feature branch into `main`
  - keeps the record of when/how it landed
  - required once a branch is shared with others

## Golden rule

> Don't rebase commits that exist outside your local repo (already pushed & shared).

If in doubt: merge. Rebase only what's still private.
