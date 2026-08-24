> Explain the difference between git rebase and git merge. When should I use each one and what are the tradeoffs?

---

# git rebase vs git merge

Both integrate changes from one branch into another, but they do it differently.

## The core difference

**Merge** creates a new "merge commit" that ties two branch histories together. It's non-destructive—your existing commits are untouched.

```
     A---B---C  feature
    /         \
D---E---F---G---M  main   (M = merge commit)
```

**Rebase** moves your commits to replay on top of another branch, rewriting history to create a linear sequence.

```
              A'--B'--C'  feature
             /
D---E---F---G  main
```

## When to use each

### Use `merge` when:
- You're integrating a completed feature into a **shared/public branch** (like `main`)
- You want to **preserve the true history** of how work happened
- Multiple people are working on the same branch
- You want a record that a feature branch existed

### Use `rebase` when:
- You want a **clean, linear history** that's easy to read
- You're **updating your local feature branch** with the latest from `main` before opening a PR
- You want to **clean up your own commits** before sharing (interactive rebase: `git rebase -i`)

## Tradeoffs

| | Merge | Rebase |
|---|---|---|
| History | Preserves actual timeline, but can get noisy | Clean and linear |
| Safety | Non-destructive | Rewrites commits (new hashes) |
| Debugging | Merge commits can clutter `git bisect`/`git log` | Easier to follow |
| Conflicts | Resolved once, in the merge commit | May resolve repeatedly across commits |

## The Golden Rule ⚠️

**Never rebase commits that have been pushed to a shared branch** that others are using. Rebasing rewrites history, so anyone who pulled the old commits will have a diverging history, causing painful conflicts.

Rebase *private/local* work freely; merge *public* work.

## A common workflow

```bash
# On your feature branch, keep it current with main (private branch = safe to rebase)
git checkout feature
git rebase main

# When done, merge into main (often with --no-ff to keep a record)
git checkout main
git merge --no-ff feature
```

This gives you the best of both: a clean linear feature history, plus a clear merge point on `main`.

**TL;DR:** Rebase for cleaning up your local work; merge for integrating into shared branches. Never rebase public history.

Want me to explain interactive rebase or squash merges next?
