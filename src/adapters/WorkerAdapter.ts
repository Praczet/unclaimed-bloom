import { spawn } from 'node:child_process';
import type { WorkerConfig } from '../core/types';

export interface WorkerResult {
    exitCode: number;
    stdout:   string;
    stderr:   string;
}

export class WorkerAdapter {

    public run(config: WorkerConfig): Promise<WorkerResult> {
        return new Promise((resolve, reject) => {
            const proc = spawn(config.command, config.args, {
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
            proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

            proc.on('close', (code) => {
                resolve({ exitCode: code ?? 1, stdout, stderr });
            });

            proc.on('error', (err) => {
                reject(new Error(`Failed to start "${config.command}": ${err.message}`));
            });
        });
    }

    public async runOrThrow(config: WorkerConfig): Promise<WorkerResult> {
        const result = await this.run(config);
        if (result.exitCode !== 0) {
            const cmd     = [config.command, ...config.args].join(' ');
            const snippet = result.stderr.trim().split('\n').slice(0, 5).join('\n');
            throw new Error(
                `Worker exited with code ${result.exitCode}.\n` +
                `Command: ${cmd}\n` +
                (snippet ? `Stderr:\n${snippet}` : '(no stderr)'),
            );
        }
        return result;
    }
}
