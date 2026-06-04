import { spawn }              from 'node:child_process';
import { mkdir, writeFile }  from 'node:fs/promises';
import { dirname }           from 'node:path';
import type { Report, Spore } from '../core/types';

const REQUIRED_TOKENS = [
    'background', 'text', 'muted', 'grid', 'axis',
    'weightLine', 'stepsBar', 'success', 'warning', 'danger',
];

export interface PotatoAdapterConfig {
    outputPath: string;
    postHook?:  string;
}

function runDetached(cmd: string): void {
    const child = spawn('sh', ['-c', cmd], { detached: true, stdio: 'ignore' });
    child.unref();
}

export class PotatoAdapter {
    public async apply(spore: Spore, config: PotatoAdapterConfig): Promise<Report> {
        const startedAt = new Date().toISOString();

        const missing = REQUIRED_TOKENS.filter(k => spore.colors[k] === undefined);
        if (missing.length > 0) {
            throw new Error(`Recipe "${spore.recipe}" is missing potato tokens: ${missing.join(', ')}`);
        }

        const c = spore.colors as Record<string, string>;
        const theme = {
            name:       'unclaimed-bloom',
            fontFamily: 'sans-serif',
            colors: {
                background:  c['background']!,
                text:        c['text']!,
                muted:       c['muted']!,
                grid:        c['grid']!,
                axis:        c['axis']!,
                weightLine:  c['weightLine']!,
                weightPoint: c['text']!,
                stepsBar:    c['stepsBar']!,
                success:     c['success']!,
                warning:     c['warning']!,
                danger:      c['danger']!,
            },
        };

        await mkdir(dirname(config.outputPath), { recursive: true });
        await writeFile(config.outputPath, JSON.stringify(theme, null, 2) + '\n', 'utf8');

        if (config.postHook) runDetached(config.postHook);

        return {
            target:     spore.target,
            profile:    spore.profile,
            recipe:     spore.recipe,
            status:     'ok',
            inputs:     { basePalette: spore.recipe },
            outputs:    [config.outputPath],
            warnings:   [],
            errors:     [],
            startedAt,
            finishedAt: new Date().toISOString(),
        };
    }
}
