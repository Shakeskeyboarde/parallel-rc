type ArgParser<TValue> = (arg: string) => TValue;
type Args<TParsers extends Record<string, ArgParser<any>>> = {
  readonly get: <TKey extends keyof TParsers>(arg: TKey) => ReturnType<TParsers[TKey]> | undefined;
  readonly getAll: <TKey extends keyof TParsers>(arg: TKey) => readonly ReturnType<TParsers[TKey]>[];
  readonly getRequired: <TKey extends keyof TParsers>(arg: TKey) => ReturnType<TParsers[TKey]>;
  readonly has: (arg: keyof TParsers) => boolean;
  readonly positional: readonly string[];
};

const parseArgs = <
  TParsers extends Record<keyof TParsers, ArgParser<any> | BooleanConstructor>,
  TAliases extends Record<keyof TAliases, keyof TParsers>,
>(
  argv: readonly string[],
  parsers: TParsers,
  aliases: TAliases = {} as TAliases,
): Args<TParsers> => {
  argv = [...argv];

  const options: { [P in keyof TParsers]?: { name: P; parse: TParsers[P] } } = Object.create(null);
  const aliasOptions: { [P in keyof TAliases]?: { name: TAliases[P]; parse: TParsers[TAliases[P]] } } =
    Object.create(null);
  const values: {
    [P in keyof TParsers]?: readonly ReturnType<TParsers[P]>[];
  } = Object.create(null);
  const positional: string[] = [];

  (Object.getOwnPropertyNames(parsers) as (keyof TParsers)[]).forEach((key) => {
    options[key] = { name: key, parse: parsers[key] };
  });
  (Object.getOwnPropertyNames(aliases) as (keyof TAliases)[]).forEach((key) => {
    aliasOptions[key] = { name: aliases[key], parse: parsers[aliases[key]] };
  });

  const nextArg = (): string | undefined => {
    const value = argv.at(0);
    argv = argv.slice(1);
    return value;
  };

  const addValue = <TKey extends keyof TParsers>(name: TKey, value: ReturnType<TParsers[TKey]>): void => {
    values[name] = [...(values[name] ?? []), value];
  };

  let arg: string | undefined;

  while ((arg = nextArg()) != null) {
    if (arg === '--') {
      positional.push(...argv);
      break;
    }

    const match = arg.match(/^(?<dashes>-{1,2})(?<name>[^=]*)(?:=(?<maybeValue>.*))?$/su);

    if (!match?.groups || match.groups.dashes == null || match.groups.name == null) {
      positional.push(arg);
      continue;
    }

    const { dashes, name, maybeValue } = match.groups;

    if (dashes === '-') {
      const chars = Array.from(name);

      if (chars.length > 1) {
        if (maybeValue != null) {
          argv = [maybeValue, ...argv];
        }

        argv = [...chars.filter((char) => char !== '-').map((char) => `-${char}`), ...argv];
        continue;
      }
    }

    const option = options[name as keyof TParsers] ?? aliasOptions[name as keyof TAliases];

    if (!option) {
      throw new Error(`Option ${JSON.stringify(arg)} is unknown`);
    }

    if (option.parse === Boolean) {
      if (maybeValue != null) {
        throw new Error(`Option ${JSON.stringify(arg)} does not accept a value`);
      }

      addValue(option.name, true as ReturnType<typeof option.parse>);
      continue;
    }

    const value = maybeValue ?? nextArg();

    if (value == null) {
      throw new Error(`Option ${JSON.stringify(arg)} requires a value`);
    }

    const parsedValue = (() => {
      try {
        return option.parse(value);
      } catch (error: any) {
        throw new Error(`Option ${JSON.stringify(arg)} value is invalid.\n${error?.message || error}`);
      }
    })();

    if (parsedValue == null) {
      throw new Error(`Option ${JSON.stringify(arg)} value is invalid`);
    }

    addValue(option.name, parsedValue);
  }

  const args = {
    get: <TKey extends keyof TParsers>(key: TKey): ReturnType<TParsers[TKey]> | undefined => {
      return values[key]?.at(-1);
    },
    getAll: <TKey extends keyof TParsers>(key: TKey): ReturnType<TParsers[TKey]>[] => {
      return [...(values[key] ?? [])];
    },
    getRequired: <TKey extends keyof TParsers>(key: TKey): ReturnType<TParsers[TKey]> => {
      const value = args.get(key);

      if (value == null) {
        throw new Error(`Missing required argument ${JSON.stringify(key)}`);
      }

      return value;
    },
    has: (key: keyof TParsers): boolean => {
      return Boolean(values[key]?.length);
    },
    positional,
  };

  return args;
};

export { type ArgParser, type Args, parseArgs };
