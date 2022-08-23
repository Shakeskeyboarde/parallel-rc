import nodeOs from 'node:os';
import nodeUtil from 'node:util';

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
  const options = nodeUtil.parseArgs({
    allowPositionals: true,
    args: [...args],
    options: {
      all: { short: 'a', type: 'boolean' },
      color: { type: 'boolean' },
      concurrency: { short: 'c', type: 'string' },
      help: { short: 'h', type: 'boolean' },
      'no-color': { type: 'boolean' },
      order: { short: 'o', type: 'boolean' },
      shell: { short: 's', type: 'string' },
      version: { short: 'v', type: 'boolean' },
    },
  });

  return {
    all: Boolean(options.values.all),
    color: options.values['no-color'] ?? Boolean(options.values.color),
    concurrency: Math.max(1, Number(options.values.concurrency)) || nodeOs.cpus().length + 1,
    filenames: options.positionals,
    help: Boolean(options.values.help),
    order: Boolean(options.values.order),
    shell: options.values.shell,
    version: Boolean(options.values.version),
  };
};

export { type Options, getOptions };
