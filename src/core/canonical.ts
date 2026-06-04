export const CANONICAL_KEYS = [
    'background',
    'background_dark',
    'background_highlight',
    'foreground',
    'foreground_dark',
    'comment',
    'border',
    'red',
    'green',
    'yellow',
    'blue',
    'purple',
    'magenta',
    'cyan',
    'teal',
    'orange',
    'selection_background',
    'selection_foreground',
] as const;

export type CanonicalKey = typeof CANONICAL_KEYS[number];
