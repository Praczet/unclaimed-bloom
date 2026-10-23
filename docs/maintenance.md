# Maintenance

Reports and events accumulate with every run. After enough wallpapers the
`reports/` folder holds thousands of files and `events.jsonl` grows to several MB.

Trim them without touching the working cache:

```bash
spore prune                 # trim reports and the event log
spore prune --keep 20       # keep the twenty most recent reports
spore prune --rendered      # also clear rendered output (grow again before plant)
spore prune --all           # full reset, blooms and spores too (needs a full cycle)
spore prune --dry-run       # show what would go, delete nothing
```

## Stale config

Files that exist in `~/.config/unclaimed-bloom` but no longer in the repo (a
retired target, a deleted recipe) are listed by `spore sync` and removed by
`spore sync --prune`. claimed-bloom's Check shows them too.
