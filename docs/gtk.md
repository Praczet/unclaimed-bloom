# GTK

GTK gets a profile of its own inside every desktop composition, so it can use a
different palette, mood or set of recipes than the rest of the desktop.

```text
desktop                     daily-gtk [gtk]              + daily
desktop-graphite-blooming   daily-gtk-blooming [gtk,gimp] + daily-graphite-blooming
desktop-ash-dark-dormant    daily-ash-dark-gtk-dormant [gtk,gimp] + daily-ash-dark-dormant
…
```

The first run themes only GTK (and GIMP, whose theme follows GTK); the second
themes everything else. The original `desktop` composition shows why: the rest
of the desktop is TokyoNight Moon, while GTK uses the calmer Nord Tweak Dark.
The graphite and ash compositions keep one palette and mood for both runs but
still give GTK its own recipes.

The broad `daily-*` profiles do not include GTK; the `*-gtk*` profiles include
nothing else.

```bash
spore profile show desktop-graphite-blooming   # the runs and their targets
```

> [!WARNING]
> GTK is not fully swallowed yet.
>
> Unclaimed Bloom owns the generated GTK colours and recipes. The structural GTK
> theme (widget CSS, button shapes, scrollbars, Thunar-specific rules) still
> lives in the sibling repo
> [adart-matugener-gtk-theme](https://github.com/Praczet/adart-matugener-gtk-theme).
>
> The plant hook writes generated colour CSS to the live theme install only:
>
> ```text
> ~/.local/share/themes/ADArt-Unclaimed-Bloom/gtk-{3,4}.0/gtk-adart-unclaimed-bloom.css
> ~/.config/gtk-4.0/gtk.css
> ```
>
> The sibling repo is no longer written to by the plant hook, but it must still
> be installed, because its widget/app CSS files are what the theme skeleton
> imports.
>
> Do not delete that repo until the GTK skeleton is moved into `targets/gtk/`.
>
> Future Adam, yes, this warning is for you.
