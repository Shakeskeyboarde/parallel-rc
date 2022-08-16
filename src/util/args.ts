type ArgParser<TValue> = (arg: string) => TValue;
type ArgOption = ArgParser<any> | readonly [...alias: readonly string[], parse: ArgParser<any> | true] | true;
type ArgsOptions = {
  readonly [key: string]: ArgOption;
};
type ArgParserType<TParser> = TParser extends ArgParser<infer TValue> ? TValue : true;
type ArgType<TOption> = TOption extends readonly [...alias: readonly string[], parse: infer TParser]
  ? ArgParserType<TParser>
  : ArgParserType<TOption>;
type Args<TOptions extends ArgsOptions> = {
  readonly get: <TKey extends keyof TOptions>(arg: TKey) => ArgType<TOptions[TKey]> | undefined;
  readonly getAll: <TKey extends keyof TOptions>(arg: TKey) => readonly ArgType<TOptions[TKey]>[];
  readonly getRequired: <TKey extends keyof TOptions>(arg: TKey) => ArgType<TOptions[TKey]>;
  readonly has: (arg: keyof TOptions) => boolean;
  readonly positional: readonly string[];
};

const parseArgs = <TOptions extends ArgsOptions>(argv: readonly string[], options: TOptions): Args<TOptions> => {
  const values: { [P in keyof TOptions]?: readonly ArgType<TOptions[P]>[] } = Object.create(null);
  const positional: string[] = [];
  const aliases: Partial<Record<string, keyof TOptions>> = Object.create(null);

  (Object.getOwnPropertyNames(options) as (keyof TOptions)[]).forEach((name) => {
    const option = options[name];

    if (option instanceof Array) {
      option
        .filter((value): value is string => typeof value === 'string')
        .forEach((alias) => {
          aliases[alias] = name;
        });
    }
  });

  const nextArg = (): string | undefined => {
    const value = argv.at(0);
    argv = argv.slice(1);
    return value;
  };

  const getOption = (argName: string): { name: keyof TOptions; parse: ArgParser<any> | true } | null => {
    const name = Object.hasOwn(options, argName) ? (argName as keyof TOptions) : aliases[argName];
    const option: ArgOption | undefined = name != null ? options[name] : undefined;
    const parse =
      option instanceof Array ? option.find((entry): entry is ArgParser<any> => typeof entry !== 'string') : option;

    return name != null && parse != null ? { name, parse } : null;
  };

  const getValue = (value: string, parse: ArgParser<any>): any => {
    try {
      return parse === Boolean
        ? value.toLowerCase() === 'true'
          ? true
          : value.toLowerCase() === 'false'
          ? false
          : null
        : parse(value);
    } catch (error: any) {
      throw new Error(`Option ${JSON.stringify(arg)} value is invalid.\n${error?.message || error}`);
    }
  };

  const addValue = <TKey extends keyof TOptions>(name: TKey, value: ArgType<TOptions[TKey]>): void => {
    values[name] = [...(values[name] ?? []), value];
  };

  let arg: string | undefined;

  while ((arg = nextArg()) != null) {
    const match = arg.match(/^(?<dashes>-{1,2})(?<argName>[^=]+)(?:=(?<argValue>.*))?$/su);

    if (!match?.groups || match.groups.dashes == null || match.groups.argName == null) {
      positional.push(arg);
      continue;
    }

    const { dashes, argName, argValue } = match.groups;

    if (dashes === '-') {
      const chars = Array.from(argName);

      if (chars.length > 1) {
        argv = [
          ...chars.filter((char) => char !== '-').map((char) => `-${char}`),
          ...(argValue != null ? [argValue] : []),
          ...argv,
        ];
        continue;
      }
    }

    const option = getOption(argName);

    if (!option) {
      throw new Error(`Option ${JSON.stringify(arg)} is unknown`);
    }

    const { name, parse } = option;

    if (typeof parse !== 'function') {
      if (argValue != null) {
        throw new Error(`Option ${JSON.stringify(arg)} does not accept a value`);
      }

      addValue(name, true as any);
      continue;
    }

    const maybeValue = argValue ?? nextArg();

    if (maybeValue == null) {
      throw new Error(`Option ${JSON.stringify(arg)} requires a value`);
    }

    const value = getValue(maybeValue, parse);

    if (value == null) {
      throw new Error(`Option ${JSON.stringify(arg)} value is invalid`);
    }

    addValue(name, value);
  }

  const args = {
    get: <TKey extends keyof TOptions>(key: TKey): ArgType<TOptions[TKey]> | undefined => {
      return values[key]?.at(-1);
    },
    getAll: <TKey extends keyof TOptions>(key: TKey): ArgType<TOptions[TKey]>[] => {
      return [...(values[key] ?? [])];
    },
    getRequired: <TKey extends keyof TOptions>(key: TKey): ArgType<TOptions[TKey]> => {
      const value = args.get(key);

      if (value == null) {
        throw new Error(`Missing required argument ${JSON.stringify(key)}`);
      }

      return value;
    },
    has: (key: keyof TOptions): boolean => {
      return Boolean(values[key]?.length);
    },
    positional,
  };

  return args;
};

export { type ArgParser, type Args, parseArgs };
