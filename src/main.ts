import { create as createColors } from 'ansi-colors';
import spawn from 'cross-spawn';
import assert from 'node:assert';
import { type ChildProcess } from 'node:child_process';
import nodeFs from 'node:fs';
import module from 'node:module';
import os from 'node:os';
import { createSupportsColor } from 'supports-color';

import { parseArgs } from './args.js';
import { limit } from './limit.js';
import { createLogger } from './logger.js';
import { usage } from './usage.js';

const main = async (argv = process.argv.slice(2)): Promise<void> => {
  const interrupted = { value: false };
  const childProcesses = new Set<ChildProcess>();
  const interrupt = () => {
    process.stderr.clearLine(0);
    process.stderr.cursorTo(0);
    interrupted.value = true;
    childProcesses.forEach((childProcess) => childProcess.kill('SIGINT'));
  };

  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);

  const colors = createColors();
  const args = parseArgs(
    argv,
    {
      all: Boolean,
      color: Boolean,
      concurrency: Number,
      help: Boolean,
      'no-color': Boolean,
      version: Boolean,
    },
    {
      a: 'all',
      c: 'concurrency',
      h: 'help',
      v: 'version',
    },
  );

  colors.enabled =
    !args.has('no-color') &&
    (args.has('color') ||
      (Boolean(createSupportsColor(process.stdout, { sniffFlags: false })) &&
        Boolean(createSupportsColor(process.stderr, { sniffFlags: false }))));

  if (args.has('help')) {
    usage();
    return;
  }

  if (args.has('version')) {
    console.log(module.createRequire(import.meta.url)('../package.json').version);
    return;
  }

  const all = args.has('all');
  const concurrency = args.get('concurrency') ?? os.cpus().length + 1;
  const filenames = args.positional;

  assert(concurrency > 0, 'Concurrency must be greater than zero');
  assert(filenames.length, 'One command filename is required');

  const limiter = limit(concurrency);
  const config = await Promise.all(
    filenames.map((filename) =>
      limiter.run(async () =>
        interrupted.value
          ? ''
          : nodeFs.promises
              .readFile(filename + '.rc', 'utf8')
              .catch(() => nodeFs.promises.readFile(filename, 'utf8'))
              .catch(() => {
                throw new Error(`File not found (${JSON.stringify(filename + '.rc')}, ${JSON.stringify(filename)})`);
              }),
      ),
    ),
  ).then((values) => values.join('\n'));

  if (interrupted.value) {
    return;
  }

  const errors: [index: number, reason: string][] = [];
  const commands = config
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  const promises = commands
    .map((command, i) => () => {
      return new Promise<void>((resolve) => {
        if (interrupted.value || (errors.length && !all)) {
          resolve();
          return;
        }

        const intro = createLogger({ prefix: colors.dim(`${i}> `), wrap: colors.bold, write: process.stderr });
        const output = createLogger({ prefix: colors.dim(`${i}: `), write: process.stdout });
        const error = createLogger({ prefix: colors.dim(`${i}! `), wrap: colors.red, write: process.stderr });
        const finish = () => {
          intro.flush();
          output.flush();
          error.flush();
          resolve();
        };

        intro.log(command);

        const childProcess = spawn(command, { env: { ...process.env, TERM: 'dumb' }, shell: true, stdio: 'pipe' });

        childProcesses.add(childProcess);
        childProcess.stdin?.end();
        childProcess.stdout?.setEncoding('utf8').on('data', output.write);
        childProcess.stderr?.setEncoding('utf8').on('data', output.write);
        childProcess.on('error', (err) => {
          childProcesses.delete(childProcess);

          if (process.exitCode == null) {
            process.exitCode = 1;
          }

          error.log(`${err}`);
          errors.push([i, err.name]);
          finish();
        });
        childProcess.on('exit', (code, signal) => {
          childProcesses.delete(childProcess);

          if (code !== 0 && process.exitCode == null) {
            process.exitCode = 1;
          }

          if (code != null) {
            if (code !== 0) {
              errors.push([i, `Code: ${code}`]);
            }
          } else if (signal != null) {
            errors.push([i, signal]);
          } else {
            errors.push([i, '']);
          }

          finish();
        });
      });
    })
    .map(limiter.run);

  await Promise.allSettled(promises);

  errors
    .sort(([a], [b]) => a - b)
    .forEach(([index, reason]) => {
      console.error(colors.red(`Failed command ${index}${reason ? ` (${reason})` : ''}`));
    });
};

export { main };
