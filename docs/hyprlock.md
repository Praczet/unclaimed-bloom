# Hyprlock

Hyprlock is a first-class target:

```text
targets/hyprlock/
├── recipes/subtle-ish.json
├── recipes/graphite-tweak-ish.json
├── templates/hyprlock.conf
└── hooks/plant.json
```

It plants:

```text
~/.config/hypr/hyprlock.conf
```

The lock-screen background is prepared separately, during the same plant, by:

```text
scripts/hyprlock-prepare-bg
```

That script reads the current wallpaper from
`~/.cache/unclaimed-bloom/current-wallpaper`, calls the existing helper
`~/.local/bin/hyprlock-gap-bg`, and writes `~/.cache/hyprlock-current.png`.

So Hyprlock gets the same gap/blur background behaviour as the old bin-script
flow, but now it happens during `spore plant`. It is also why planting takes a
while: preparing that background is one of the two slowest steps (the other is
icons).

It needs ImageMagick, `hyprctl` and `jq`.
