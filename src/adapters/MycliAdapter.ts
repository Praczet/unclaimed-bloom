import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Report, Spore } from '../core/types';
import { WorkerAdapter } from './WorkerAdapter';

const REQUIRED_TOKENS = [
    'bg', 'bg_dark', 'bg_high', 'bg_selected', 'bg_meta', 'bg_tertiary',
    'fg', 'fg_muted', 'comment',
    'blue', 'cyan', 'green', 'yellow', 'red', 'magenta', 'purple', 'orange',
    'on_primary', 'on_secondary', 'on_tertiary',
    'error_bg', 'error_fg',
];

function requireToken(colors: Record<string, string>, key: string, recipe: string): string {
    const value = colors[key];
    if (value === undefined) throw new Error(`Recipe "${recipe}" is missing required token "${key}"`);
    return value;
}

function renderIni(spore: Spore): string {
    const c = spore.colors;
    const r = (key: string) => requireToken(c, key, spore.recipe);

    const bg          = r('bg');
    const bgDark      = r('bg_dark');
    const bgHigh      = r('bg_high');
    const bgSelected  = r('bg_selected');
    const bgMeta      = r('bg_meta');
    const bgTertiary  = r('bg_tertiary');
    const fg          = r('fg');
    const fgMuted     = r('fg_muted');
    const comment     = r('comment');
    const blue        = r('blue');
    const cyan        = r('cyan');
    const green       = r('green');
    const yellow      = r('yellow');
    const red         = r('red');
    const magenta     = r('magenta');
    const purple      = r('purple');
    const orange      = r('orange');
    const onPrimary   = r('on_primary');
    const onSecondary = r('on_secondary');
    const onTertiary  = r('on_tertiary');
    const errorBg     = r('error_bg');
    const errorFg     = r('error_fg');

    const q = (s: string) => `'${s}'`;

    // Suppress unused-variable warnings — all vars above feed the style map.
    void bg;

    const styles: Record<string, string> = {
        // Completion menus
        'completion-menu.completion.current':       `bg:${bgSelected} ${onPrimary} bold`,
        'completion-menu.completion':               `bg:${bgHigh} ${fg}`,
        'completion-menu.meta.completion.current':  `bg:${bgMeta} ${onSecondary}`,
        'completion-menu.meta.completion':          `bg:${bgDark} ${fgMuted}`,
        'completion-menu.multi-column-meta':        `bg:${bgMeta} ${onSecondary}`,
        'scrollbar.arrow':                          `bg:${bgDark}`,
        'scrollbar':                                `bg:${blue}`,
        // Prompt
        'prompt':                                   `${blue} bold`,
        'continuation':                             purple,
        // Table output
        'output.table-separator':                   comment,
        'output.header':                            `${blue} bold`,
        'output.odd-row':                           '',
        'output.even-row':                          '',
        'output.null':                              `${comment} italic`,
        'output.status':                            fgMuted,
        'output.status.warning-count':              `${red} bold`,
        'output.timing':                            purple,
        // Selection and search
        'selected':                                 `${onSecondary} bg:${bgMeta}`,
        'search':                                   `${onTertiary} bg:${bgTertiary}`,
        'search.current':                           `${onPrimary} bg:${bgSelected} bold`,
        // Bottom toolbar
        'bottom-toolbar':                           `bg:${bgDark} ${fgMuted}`,
        'bottom-toolbar.off':                       `bg:${bgDark} ${comment}`,
        'bottom-toolbar.on':                        `bg:${bgDark} ${blue} bold`,
        'bottom-toolbar.transaction.valid':         `bg:${bgDark} ${green} bold`,
        'bottom-toolbar.transaction.failed':        `bg:${bgDark} ${red} bold`,
        // Other toolbars
        'search-toolbar':                           `noinherit bold ${blue}`,
        'search-toolbar.text':                      `nobold ${fg}`,
        'system-toolbar':                           `noinherit bold ${purple}`,
        'arg-toolbar':                              `noinherit bold ${magenta}`,
        'arg-toolbar.text':                         `nobold ${fg}`,
        // Matching brackets
        'matching-bracket.cursor':                  `${errorFg} bg:${errorBg} bold`,
        'matching-bracket.other':                   `${onSecondary} bg:${bgMeta}`,
        // SQL syntax highlighting
        'sql.comment':                              `italic ${comment}`,
        'sql.comment.multi-line':                   `italic ${comment}`,
        'sql.comment.single-line':                  `italic ${comment}`,
        'sql.keyword':                              `bold ${blue}`,
        'sql.datatype':                             purple,
        'sql.literal':                              cyan,
        'sql.constant':                             yellow,
        'sql.function':                             blue,
        'sql.variable':                             magenta,
        'sql.number':                               yellow,
        'sql.operator':                             comment,
        'sql.punctuation':                          fgMuted,
        'sql.string':                               green,
        'sql.string.escape':                        `bold ${orange}`,
    };

    const lines = [
        '# mycli colors — generated by Unclaimed Bloom / spore.',
        '# Do not edit this file directly.',
        '',
        '[colors]',
        ...Object.entries(styles).map(([k, v]) => `${k} = ${q(v)}`),
        '',
    ];
    return lines.join('\n');
}

export interface MycliApplyOptions {
    iniPath:      string;
    baseConfPath: string;
    outputPath:   string;
    workerPath:   string;
}

export class MycliAdapter {
    private readonly worker = new WorkerAdapter();

    public async apply(spore: Spore, opts: MycliApplyOptions): Promise<Report> {
        const startedAt = new Date().toISOString();
        const warnings: string[] = [];

        const missing = REQUIRED_TOKENS.filter(k => spore.colors[k] === undefined);
        if (missing.length > 0) {
            throw new Error(`Recipe "${spore.recipe}" is missing tokens:\n  ${missing.join(', ')}`);
        }

        const ini = renderIni(spore);
        await mkdir(dirname(opts.iniPath), { recursive: true });
        await writeFile(opts.iniPath, ini, 'utf8');

        const result = await this.worker.run({
            command: opts.workerPath,
            args:    [opts.baseConfPath, opts.iniPath, opts.outputPath],
        });

        if (result.exitCode !== 0) {
            warnings.push(`matugen-mycli-apply exited ${result.exitCode}: ${result.stderr.trim()}`);
        }

        return {
            target:     spore.target,
            profile:    spore.profile,
            recipe:     spore.recipe,
            status:     result.exitCode === 0 ? 'ok' : 'warning',
            inputs:     { baseConf: opts.baseConfPath, ini: opts.iniPath },
            outputs:    [opts.iniPath, ...(result.exitCode === 0 ? [opts.outputPath] : [])],
            warnings,
            errors:     [],
            startedAt,
            finishedAt: new Date().toISOString(),
        };
    }
}
