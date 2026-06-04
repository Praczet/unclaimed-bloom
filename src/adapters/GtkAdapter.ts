import { execFile }                   from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname }                    from 'node:path';
import { promisify }                  from 'node:util';
import type { Report, Spore }         from '../core/types';

const execFileAsync = promisify(execFile);

export interface GtkAdapterConfig {
    templatePath: string;
    outputPaths:  string[];
    themeName:    string;
}

export class GtkAdapter {
    public async apply(spore: Spore, config: GtkAdapterConfig): Promise<Report> {
        const startedAt = new Date().toISOString();

        const template = await readFile(config.templatePath, 'utf8');

        const missing: string[] = [];
        const css = template.replace(
            /\{\{([a-z_]+)\}\}/g,
            (_, key: string) => {
                const color = spore.colors[key];
                if (color === undefined) { missing.push(key); return ''; }
                return color;
            },
        );

        if (missing.length > 0) {
            throw new Error(
                `Recipe "${spore.recipe}" is missing tokens: ${missing.join(', ')}`,
            );
        }

        for (const outputPath of config.outputPaths) {
            await mkdir(dirname(outputPath), { recursive: true });
            await writeFile(outputPath, css, 'utf8');
        }

        await execFileAsync('gsettings', [
            'set', 'org.gnome.desktop.interface', 'gtk-theme', config.themeName,
        ]);

        return {
            target:     spore.target,
            profile:    spore.profile,
            recipe:     spore.recipe,
            status:     'ok',
            inputs:     { templatePath: config.templatePath },
            outputs:    config.outputPaths,
            warnings:   [],
            errors:     [],
            startedAt,
            finishedAt: new Date().toISOString(),
        };
    }
}
