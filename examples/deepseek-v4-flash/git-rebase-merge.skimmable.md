## Git rebase vs merge — the short answer

**Merge preserves history; rebase rewrites it. Use merge for public branches, rebase to clean up your own commits before pushing.**

## What each does

- **`git merge`** — combines two branches by creating a *merge commit* that ties the histories together. Original commits stay untouched.
- **`git rebase`** — takes your commits, *replays them one by one* on top of another branch, then moves your branch pointer. Your commits get new hashes.

## Visual difference

**Merge** — history shows both branches converging:

```
      A---B---C  feature
     /         \
D---E---F-------M  main
                 ^ merge commit
```

**Rebase** — history becomes one straight line:

```
                A'--B'--C'  feature
               /
D---E---F------  main
        ^ feature was rewound, then replayed
```

- A', B', C' are *copies* of A, B, C — same changes, different hashes.

## When to use which

**Use merge when...**

- Working on a **shared branch** (main, develop) — it never rewrites anyone else's work
- You want history to show *when* things were integrated, not just the final shape
- You want zero risk — a merge can always be undone cleanly

**Use rebase when...**

- Your **feature branch** hasn't been pushed/shared yet — you want a clean, linear history
- Pulling upstream changes into your feature branch (`git pull --rebase`) to avoid ugly merge commits
- You care about a tidy `git log` and easy `git bisect`

## Tradeoffs

| | Merge | Rebase |
|---|---|---|
| **History** | Shows real timeline, has merge commits | Clean, linear, reads like a story |
| **Safety** | Safe everywhere | Only safe on unshared branches |
| **Conflict resolution** | Once, in the merge commit | Once *per commit* being replayed (can be painful) |
| **Undoing** | Trivial — revert the merge | Hard — history was rewritten |
| **Shared branches** | ✅ Fine | ❌ Rewrites commits others may have based on |

## The golden rule

> **Never rebase commits you've already pushed to a shared branch.** You'll rewrite history other people have pulled from, and they'll get duplicate commits or lost work on their next pull.

## Typical workflow

```bash
# Feature branch: rebase to stay current with main, before pushing
git switch feature
git rebase main

# Integration: merge to combine
git switch main
git merge feature
```

- One common hybrid: rebase your local feature to keep it clean, then merge (or fast-forward) into main once it's ready.

## When conflicts get ugly

**Merge** — resolve conflicts once; the merge commit records *both* sides of the story.

**Rebase** — you resolve conflicts against each commit being replayed, in sequence:

```bash
git rebase main          # conflict
git add fixed-file.js
git rebase --continue    # conflict again, on the next commit...
```

- If rebase goes sideways: `git rebase --abort` returns you to where you started.
