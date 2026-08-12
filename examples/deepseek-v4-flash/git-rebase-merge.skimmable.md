### Quick answer

- **Merge** — combines two branches with a merge commit; preserves the real timeline.
- **Rebase** — replays your commits on top of another branch; produces a linear history.

### Visual difference

```
Merge (preserves both paths)
      A---B---C  (feature)
     /           \
D---E---F---G-----H  (main)
                   ↑ merge commit
```

```
Rebase (feature commits rewritten on top of main)
                  A'---B'---C'  (feature)
                 /
D---E---F---G  (main)
```

- After rebase, `feature` looks like it was always based on the latest `main`.
- The old commits `A`, `B`, `C` are abandoned; new commits `A'`, `B'`, `C'` are created.

### When to use each

**Use merge when**

- The branch is **shared/public** — merge never rewrites history.
- You want to preserve the real order of events for auditing/archaeology.
- You're integrating a finished feature into main and want a clear "this feature landed here" commit.
- Your team's convention says so.

**Use rebase when**

- Cleaning up **unpushed** local commits (`git rebase -i`: squash, reorder, edit).
- Updating your own feature branch against latest main to keep history linear.
- Keeping a tidy, readable log for code review.
- Pulling remote changes with `git pull --rebase` instead of creating merge commits.

### Tradeoffs

| Aspect | Merge | Rebase |
|---|---|---|
| History | Non-linear, matches real timeline | Linear, cleaner to read |
| Safety | Safe — never rewrites history | Rewrites history — **dangerous on shared branches** |
| Conflicts | Resolved once at the merge commit | Resolved per commit as each one replays |
| Integration context | Visible where/when code joined | Lost — no marker |
| Undo | Easy (`git revert` the merge) | Painful — commits are rewritten and renumbered |
| Branch shape | Keeps intermixed commits | Topic commits stay grouped together |

### Rules of thumb

- **Public/shared branch** → merge
- **Private/unpushed branch** → rebase freely
- **Bring main into your feature** → rebase (clean, no merge noise)
- **Bring feature into main** → merge or squash-merge (`git merge --squash` gives a linear main history while preserving the feature branch as-is)

### One caveat

Rebasing a branch others have based work on makes their history diverge — their commits will reference commits that no longer exist. If a branch has been pushed, prefer merge unless the team explicitly agrees to force-push.
