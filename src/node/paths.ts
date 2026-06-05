import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const xdgConfig = process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config');
const xdgCache  = process.env['XDG_CACHE_HOME']  ?? join(homedir(), '.cache');

// Override with UB_DATA_DIR / UB_CACHE_DIR env vars during development:
//   UB_DATA_DIR=$(pwd) npm run spore grow daily
export const DATA_DIR  = process.env['UB_DATA_DIR']  ?? join(xdgConfig, 'unclaimed-bloom');
export const CACHE_DIR = process.env['UB_CACHE_DIR'] ?? join(xdgCache,  'unclaimed-bloom');

export const Paths = {
    // data (config / repo)
    palette:  (name: string)                 => join(DATA_DIR,  'palettes',          `${name}.json`),
    mood:     (name: string)                 => join(DATA_DIR,  'moods',             `${name}.json`),
    profile:  (name: string)                 => join(DATA_DIR,  'profiles',          `${name}.json`),
    target:   (target: string)               => join(DATA_DIR,  'targets', target),
    recipe:   (target: string, name: string) => {
        const targetPath = join(DATA_DIR, 'targets', target, 'recipes', `${name}.json`);
        return existsSync(targetPath) ? targetPath : join(DATA_DIR, 'recipes', target, `${name}.json`);
    },
    template: (target: string, file: string) => {
        const targetPath = join(DATA_DIR, 'targets', target, 'templates', file);
        return existsSync(targetPath) ? targetPath : join(DATA_DIR, 'templates', target, file);
    },
    script:   (name: string)                 => join(DATA_DIR,  'scripts',            name),

    // cache (generated outputs)
    bloom:   (profile: string)                  => join(CACHE_DIR, 'blooms',  `${profile}.json`),
    spore:   (profile: string, target: string)  => join(CACHE_DIR, 'spores', profile, `${target}.json`),
    // cached spore for alternate variant or named cache
    cachedSpore: (profile: string, target: string, variant: string) => join(CACHE_DIR, 'spores', profile, `${target}__${variant}.json`),
    ini:     (target: string)                   => join(CACHE_DIR, 'ini',    `${target}-colors.ini`),
    report:  (profile: string, target: string)  => join(CACHE_DIR, 'reports', profile, `${target}.json`),
    lastRun:          ()       => join(CACHE_DIR, 'reports', 'last-run.json'),
    currentProfile:   ()       => join(CACHE_DIR, 'current-profile'),
    currentWallpaper: ()       => join(CACHE_DIR, 'current-wallpaper'),
};
