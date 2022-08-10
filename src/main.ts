import { create as createColors } from 'ansi-colors';
import assert from 'node:assert';
import { type ChildProcess } from 'node:child_process';
import module from 'node:module';
import { createSupportsColor } from 'supports-color';

import { loadCommands } from './commands.js';
import { execAll } from './exec.js';
import { getOptions } from './options.js';
import { usage } from './usage.js';
import { LineStream } from './util/line-stream.js';
import { mediate } from './util/mediate.js';

const main = async (argv?: readonly string[]): Promise<void> => {
  const options = getOptions(argv);

  if (options.help) {
    usage();
    return;
  }

  if (options.version) {
    console.log(module.createRequire(import.meta.url)('../package.json').version);
    return;
  }

  assert(options.concurrency > 0, 'Concurrency must be greater than zero');
  assert(options.filenames.length, 'One command filename is required');

  const colors = { stderr: createColors(), stdout: createColors() };
  const controller = new AbortController();
  const procs = new Set<ChildProcess>();
  const onSignal = (signal: NodeJS.Signals) => {
    console.error();
    controller.abort();
    procs.forEach((proc) => proc.kill(signal));
  };

  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  colors.stdout.enabled = options.color ?? Boolean(createSupportsColor(process.stdout, { sniffFlags: false }));
  colors.stderr.enabled = options.color ?? Boolean(createSupportsColor(process.stderr, { sniffFlags: false }));

  const commands = await loadCommands(options.filenames);

  if (controller.signal.aborted) {
    return;
  }

  const errors: [index: number, reason: string][] = [];
  const activators: (() => void)[] = [];

  process.on('exit', () => {
    if (errors.length) {
      if (process.exitCode == null || process.exitCode !== 0) {
        process.exitCode = 1;
      }

      errors
        .sort(([a], [b]) => a - b)
        .forEach(([index, reason]) => {
          console.error(colors.stderr.red(`Failed command ${index}${reason ? ` (${reason})` : ''}`));
        });
    } else {
      console.error(colors.stderr.green(`Successfully completed ${commands.length} commands`));
      return;
    }
  });

  await execAll(
    commands,
    ({ proc, index, command, promise }) => {
      const [act, actMediator] = mediate((action: () => void) => action());
      const console: Pick<Console, 'error' | 'log'> = {
        error: (...args) => void act(() => global.console.error(...args)),
        log: (...args) => void act(() => global.console.log(...args)),
      };

      void promise.then(() => {
        actMediator.flush();
      });

      if (options.order) {
        if (activators.length > 0) {
          actMediator.pause();
        }

        activators.push(actMediator.resume);

        void promise.then(() => {
          activators.shift();
          void activators.at(0)?.();
        });
      }

      procs.add(proc);
      console.error(colors.stderr.dim(`${index}: `) + colors.stderr.bold.blue('$ ' + command.script));

      proc.stdout?.on('data', (line) => console.log(colors.stdout.dim(`${index}: `) + line));
      proc.stderr?.on('data', (line) => console.log(colors.stdout.dim(`${index}: `) + colors.stdout.yellow(line)));

      let error: Error | undefined;

      proc.on('error', (err) => {
        error = err;
        new LineStream()
          .on('data', (line) => console.error(colors.stderr.dim(`${index}! `) + colors.stderr.red(line)))
          .end(`${error.stack ?? error}`);
      });
      proc.on('close', (code, signal) => {
        procs.delete(proc);

        if (error) {
          errors.push([index, error.name]);
        } else if (code) {
          errors.push([index, `Code: ${code}`]);
        } else if (signal) {
          errors.push([index, signal]);
        } else {
          return;
        }

        if (!options.all) {
          controller.abort();
        }
      });
    },
    {
      abortSignal: controller.signal,
      concurrency: options.concurrency,
      order: options.order,
      shell: options.shell,
    },
  );
};

export { main };
