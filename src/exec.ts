import ansiColors from 'ansi-colors';
import spawn from 'cross-spawn';
import { type ChildProcess } from 'node:child_process';
import nodeOs from 'node:os';

import { type Command } from './commands.js';
import { limit } from './util/limit.js';
import { LineStream } from './util/line-stream.js';

type ExecCommand = {
  readonly script: string;
  readonly shell?: string;
};

type ExecContext = {
  readonly command: Command;
  readonly index: number;
  readonly proc: ChildProcess;
  readonly promise: Promise<void>;
};

type ExecOptions = {
  readonly onStart?: (proc: ChildProcess) => void;
  readonly shell?: string;
};

type ExecAllOptions = {
  readonly abortSignal?: AbortSignal;
  readonly concurrency?: number;
  readonly onStart?: (ctx: ExecContext) => void;
  readonly order?: boolean;
  readonly shell?: string;
};

const exec = async (command: Command, options: ExecOptions = {}): Promise<void> => {
  const { onStart, shell } = options;

  await new Promise<void>((resolve) => {
    const proc = spawn(command.script, {
      env: { ...process.env, TERM: 'dumb' },
      shell: shell ?? command.shell ?? true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout = proc.stdout?.pipe(new LineStream({ transform: ansiColors.stripColor })) ?? null;
    proc.stderr = proc.stderr?.pipe(new LineStream({ transform: ansiColors.stripColor })) ?? null;
    proc.on('error', () => resolve());
    proc.on('close', () => resolve());

    onStart?.(proc);
  });
};

const execAll = async (
  commands: readonly ExecCommand[],
  onStart: (ctx: ExecContext) => void,
  options: ExecAllOptions,
): Promise<void> => {
  const { abortSignal, concurrency = nodeOs.cpus().length + 1, order = false, shell } = options;
  const limiter = limit(concurrency, { sequential: order });
  const promises = commands.map(async (command, index) => {
    const promise = limiter.run(async () => {
      if (abortSignal?.aborted) {
        return;
      }

      await exec(command, { onStart: (proc) => onStart?.({ command, index, proc, promise }), shell });
    });

    await promise;
  });

  await Promise.allSettled(promises);
};

export { type ExecAllOptions, type ExecCommand, type ExecContext, type ExecOptions, exec, execAll };
