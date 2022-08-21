import { parseArgs } from 'cliopts';
import nodeOs from 'node:os';

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

const getOptions = (args: readonly string[] = process.argv.slice(2)): Options => {
  const options = parseArgs(args, {
    all: { alias: 'a', type: true },
    color: { type: true },
    concurrency: { alias: 'c', type: Number },
    help: { alias: 'h', type: true },
    'no-color': { type: false },
    order: { alias: 'o', type: true },
    shell: { alias: 's', type: String },
    version: { alias: 'v', type: true },
  });

  return {
    all: options.has('all'),
    color: options.get('no-color') ?? options.get('color'),
    concurrency: options.get('concurrency') ?? nodeOs.cpus().length + 1,
    filenames: options.positional,
    help: options.has('help'),
    order: options.has('order'),
    shell: options.get('shell'),
    version: options.has('version'),
  };
};

export { type Options, getOptions };
