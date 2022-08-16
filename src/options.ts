import nodeOs from 'node:os';

import { parseArgs } from './util/args.js';

type Options = {
  readonly all: boolean;
  readonly color: boolean | undefined;
  readonly concurrency: number;
  readonly filenames: readonly string[];
  readonly help: boolean;
  readonly order: boolean;
  readonly shell: string | undefined;
  readonly version: boolean;
};

const getOptions = (argv: readonly string[] = process.argv.slice(2)): Options => {
  const args = parseArgs(argv, {
    all: ['a', true],
    color: true,
    concurrency: ['c', Number],
    help: ['h', true],
    'no-color': true,
    order: ['o', true],
    shell: ['s', String],
    version: ['v', true],
  });

  return {
    all: args.has('all'),
    color: args.get('no-color') == null && args.get('color'),
    concurrency: args.get('concurrency') ?? nodeOs.cpus().length + 1,
    filenames: args.positional,
    help: args.has('help'),
    order: args.has('order'),
    shell: args.get('shell'),
    version: args.has('version'),
  };
};

export { type Options, getOptions };
