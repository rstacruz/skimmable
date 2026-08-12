## The short version

- **`git merge`** takes two branches and joins them with a new *merge commit*, preserving both histories exactly as they happened.
- **`git rebase`** takes the commits from your branch and *replays them on top of* another branch, rewriting your commit history into a clean, linear sequence.

---

## How merge works

Imagine you branched off `main` at commit C, added commits D and E on your feature branch, and meanwhile `main` moved forward to F:

```
        D---E   (feature)
       /
A---B---C---F   (main)
```

Running `git merge feature` (while on `main`) creates a new merge commit M with **two parents**:

```
        D---E
       /     \
A---B---C---F---M   (main)
```

- No existing commits are changed — ever.
- History is a true record of *when* work branched and rejoined.
- The result is a **non-linear** history.

## How rebase works

Same starting point. Running `git rebase main` (while on `feature`) does **not** merge. Instead, it:

1. Finds the commits unique to `feature` (D and E).
2. Saves their *changes* (diffs), not the commits themselves.
3. Re-applies them one by one **on top of** `main`'s latest commit F.
4. Leaves the old D and E behind (they still exist in the reflog for a while).

Result:

```
                      D'---E'   (feature)
                     /
A---B---C---F       (main)
```

- D′ and E′ are **brand-new commits** — new hashes, new timestamps, new authors-as-of dates, despite identical content changes.
- History is **linear**: it looks like you wrote D and E *after* F existed.
- Commit C (the original branch point) is no longer part of your branch's history at all.

---

## Key differences at a glance

| | Merge | Rebase |
|---|---|---|
| History | Non-linear (branches visible) | Linear |
| Rewrites commits | Never | Always (new hashes) |
| Safe on shared branches | ✅ Yes | ❌ No |
| Undo | Easy (`git revert` the merge commit) | Harder (requires `git reflog`) |
| Conflict resolution | Once, at the merge | Potentially once **per commit** replayed |
| Preserves branch context | ✅ Yes | ❌ No |

---

## When to use each

### Use merge when:
- **Integrating a feature branch back into `main`** — especially if the branch is public or shared. The merge commit preserves the fact that the work was done in parallel.
- **You're collaborating with others on the same branch.** Rebase would rewrite commits others may already have, causing divergent histories and duplicate commits.
- **You want an accurate historical record** of when work happened, even if it's messy. Merge never lies about what actually occurred.
- **You need an easy, safe undo.** A merge commit can be reverted in one step; a rebased branch can't.

### Use rebase when:
- **Updating your local feature branch with the latest `main`** before opening a PR. This keeps your PR's diff clean and avoids merge commits cluttering the review.
- **Cleaning up your own local commits** with `git rebase -i` — squashing "fix typo" commits together, rewording messages, reordering.
- **You want a linear, easy-to-read history** (common in open-source projects).
- **The branch is private** — only you have it, or you're working on your own fork. The golden rule: **never rebase commits that exist on anyone else's machine.**

---

## Tradeoffs

### Merge
| Pros | Cons |
|---|---|
| Safe, non-destructive | History fills up with merge commits ("noise") |
| Preserves full context | Harder to follow the story of the code |
| Simple, well-understood | Bisecting can be more confusing |
| Every merge can be reverted cleanly | `git log --graph` looks like spaghetti in busy repos |

### Rebase
| Pros | Cons |
|---|---|
| Clean, linear, readable history | Rewrites history — **dangerous on shared branches** |
| No noise from merge commits | Can lose the context of when work actually happened |
| Easier `git bisect` (linear walk) | Conflicts may need solving repeatedly (each replayed commit) |
| Squashing/fixing up local commits is trivial | Harder to undo; requires reflog archaeology |
| Your PR diff is exactly your changes | Forces force-push discipline on any shared branch |

---

## The common workflow (best of both)

This is what most teams end up with:

1. Work on a local feature branch.
2. **Rebase** (or pull with `--rebase`) to bring your branch up to date with `main` — locally, privately. Your history stays clean and conflict-heavy merge commits never touch `main`.
3. Push the branch, open a PR.
4. **Merge** (or squash-merge, which is effectively a one-commit rebase) into `main`.

You get the linear clarity of rebase on your feature branch and the safety of merge on the shared branch.

---

## The one rule that matters

> **Never rebase a branch that other people have based work on.**

Rebasing public history makes your teammates' repos diverge from yours, and they'll end up with duplicate commits and nasty merge conflicts that only you can fully untangle. If a branch has been pushed and shared, merge into it — never rewrite it.

**Final rule of thumb:** *rebase to tidy up your own work before anyone sees it; merge to put work together once other people are involved.*
