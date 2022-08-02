import { bold, dim, red, yellow } from 'ansi-colors';
import spawn from 'cross-spawn';
import assert from 'node:assert';
import nodeFs from 'node:fs';
import os from 'node:os';

import { parseArgs } from './args';
import { limit } from './limit';
import { createLogger } from './logger';
import { usage } from './usage';

const main = async (argv = process.argv.slice(2)): Promise<void> => {
  const args = parseArgs(
    argv,
    {
      all: Boolean,
      concurrency: Number,
      help: Boolean,
      version: Boolean,
    },
    {
      a: 'all',
      c: 'concurrency',
      h: 'help',
      v: 'version',
    },
  );

  if (args.has('help')) {
    usage();
    return;
  }

  if (args.has('version')) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    console.log(require('../package.json').version);
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
        const prefix = dim(i + ': ');
        const info = createLogger({ onWrite: (text) => process.stdout.write(text), prefix });
        const notice = createLogger({ decorate: bold, onWrite: (text) => process.stdout.write(text), prefix });
        const warn = createLogger({ decorate: yellow, onWrite: (text) => process.stderr.write(text), prefix });
        const error = createLogger({ decorate: red, onWrite: (text) => process.stderr.write(text), prefix });

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
      console.log(red(`Command #${index} failed (${code})`));
    });
};

export { main };
