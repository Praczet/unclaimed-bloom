import { execFile }              from 'node:child_process';
import { mkdir, writeFile }      from 'node:fs/promises';
import { dirname }               from 'node:path';
import { spawn }                 from 'node:child_process';
import { promisify }             from 'node:util';
import type { Report, Spore }    from '../core/types';

const execFileAsync = promisify(execFile);

function spawnInherited(bin: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(bin, args, { stdio: 'inherit' });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${bin} exited with code ${code}`));
        });
    });
}

const REQUIRED_TOKENS = [
    '__ADART_ICON_SURFACE__',
    '__ADART_ICON_SURFACE_DIM__',
    '__ADART_ICON_SURFACE_CONTAINER__',
    '__ADART_ICON_SURFACE_HIGH__',
    '__ADART_ICON_SURFACE_LOWEST__',
    '__ADART_ICON_ON_SURFACE__',
    '__ADART_ICON_ON_SURFACE_MUTED__',
    '__ADART_ICON_OUTLINE__',
    '__ADART_ICON_SHADOW__',
    '__ADART_ICON_ACCENT_1__',
    '__ADART_ICON_ACCENT_1_DIM__',
    '__ADART_ICON_ACCENT_1_BRIGHT__',
    '__ADART_ICON_ACCENT_2__',
    '__ADART_ICON_ACCENT_2_DIM__',
    '__ADART_ICON_ACCENT_2_BRIGHT__',
    '__ADART_ICON_ACCENT_3__',
    '__ADART_ICON_ACCENT_3_DIM__',
    '__ADART_ICON_ACCENT_3_BRIGHT__',
    '__ADART_ICON_SUCCESS__',
    '__ADART_ICON_SUCCESS_DIM__',
    '__ADART_ICON_WARNING__',
    '__ADART_ICON_WARNING_DIM__',
    '__ADART_ICON_ERROR__',
    '__ADART_ICON_ERROR_DIM__',
];

export interface IconsAdapterConfig {
    runtimePath:  string;
    workerPath:   string;
    templatePath: string;
    outputPath:   string;
    themeName:    string;
}

export class IconsAdapter {
    public async apply(spore: Spore, config: IconsAdapterConfig): Promise<Report> {
        const startedAt = new Date().toISOString();

        const missing = REQUIRED_TOKENS.filter(k => spore.colors[k] === undefined);
        if (missing.length > 0) {
            throw new Error(
                `Recipe "${spore.recipe}" is missing tokens:\n  ${missing.join(', ')}`,
            );
        }

        const runtime = JSON.stringify({ token_aliases: spore.colors }, null, 2) + '\n';
        await mkdir(dirname(config.runtimePath), { recursive: true });
        await writeFile(config.runtimePath, runtime, 'utf8');

        await spawnInherited(config.workerPath, [
            '--runtime',  config.runtimePath,
            '--template', config.templatePath,
            '--output',   config.outputPath,
            '--force',
        ]);

        await execFileAsync('gsettings', [
            'set', 'org.gnome.desktop.interface', 'icon-theme', config.themeName,
        ]);

        return {
            target:     spore.target,
            profile:    spore.profile,
            recipe:     spore.recipe,
            status:     'ok',
            inputs:     { basePalette: spore.recipe, sourcePalette: 'matugen', runtimePath: config.runtimePath },
            outputs:    [config.outputPath],
            warnings:   [],
            errors:     [],
            startedAt,
            finishedAt: new Date().toISOString(),
        };
    }
}
