import { create as createColors } from 'ansi-colors';
import spawn from 'cross-spawn';
import assert from 'node:assert';
import nodeFs from 'node:fs';
import module from 'node:module';
import os from 'node:os';
import { createSupportsColor } from 'supports-color';

import { parseArgs } from './args.js';
import { limit } from './limit.js';
import { createLogger } from './logger.js';
import { usage } from './usage.js';

const main = async (argv = process.argv.slice(2)): Promise<void> => {
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
  const filenames = args.other;

  assert(concurrency > 0, 'Concurrency must be greater than zero');
  assert(filenames.length, 'One command filename is required');

  const limiter = limit(concurrency);

  const config = await Promise.all(
    filenames.map((filename) =>
      limiter.run(() =>
        nodeFs.promises
          .readFile(filename + '.rc', 'utf8')
          .catch(() => nodeFs.promises.readFile(filename, 'utf8'))
          .catch(() => {
            throw new Error(`File not found (${JSON.stringify(filename + '.rc')}, ${JSON.stringify(filename)})`);
          }),
      ),
    ),
  ).then((values) => values.join('\n'));

  const commands = config
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  const errors: [index: number, code: number | string | null][] = [];

  const promises = commands
    .map((command, i) => () => {
      return new Promise<void>((resolve) => {
        const prefix = colors.dim(i + ': ');
        const info = createLogger({ onWrite: (text) => process.stdout.write(text), prefix });
        const notice = createLogger({ decorate: colors.bold, onWrite: (text) => process.stdout.write(text), prefix });
        const warn = createLogger({ decorate: colors.yellow, onWrite: (text) => process.stderr.write(text), prefix });
        const error = createLogger({ decorate: colors.red, onWrite: (text) => process.stderr.write(text), prefix });

        if (errors.length && !all) {
          resolve();
          return;
        }

        notice.log(`$ ${command}`);

        const childProcess = spawn(command, {
          shell: true,
          stdio: 'pipe',
        });

        childProcess.stdin?.end();
        childProcess.stdout?.setEncoding('utf8').on('data', info.write);
        childProcess.stderr?.setEncoding('utf8').on('data', warn.write);
        childProcess.on('error', (err) => {
          if (process.exitCode == null) {
            process.exitCode = 1;
          }

          errors.push([i, 'error']);
          error.log(`${err}`);
          resolve();
        });
        childProcess.on('close', (code) => {
          if (code == null || code !== 0) {
            if (process.exitCode == null) {
              process.exitCode = 1;
            }

            errors.push([i, code]);
          }

          info.flush();
          notice.flush();
          warn.flush();
          error.flush();
          resolve();
        });
      });
    })
    .map(limiter.run);

  await Promise.allSettled(promises);

  errors
    .sort(([a], [b]) => a - b)
    .forEach(([index, code]) => {
      console.log(colors.red(`Command #${index} failed (${code})`));
    });
};

export { main };
