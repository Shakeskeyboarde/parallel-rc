type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer V) => any ? V : never;
type Simplify<T> = any extends any ? { readonly [P in keyof T]: T[P] } : never;
type ArgsType<TReturn = unknown> = (value: string) => TReturn;
type ArgsOptions<TOptions extends Record<string, ArgsType>> = {
  readonly [P in keyof TOptions]: P extends `${'-'}${string}` | `${string}${'='}${string}` ? never : TOptions[P];
};
type ArgsAliases<TOptionNames, TAliases extends Record<string, TOptionNames>> = {
  readonly [P in keyof TAliases]: P extends `${'-'}${string}` | `${string}${'='}${string}` ? never : TAliases[P];
};
type Args<TOptions extends ArgsOptions<any>> = Simplify<
  UnionToIntersection<
    {
      readonly [P in keyof TOptions]: TOptions[P] extends ArgsType<infer TType>
        ? {
            readonly get: (arg: P) => TType | undefined;
            readonly getAll: (arg: P) => readonly TType[];
            readonly getRequired: (arg: P) => TType;
            readonly has: (arg: P) => boolean;
          }
        : never;
    }[keyof TOptions]
  > & { readonly positional: readonly string[] }
>;

const parseArgs = <
  TOptions extends Record<`${'-'}${string}` | `${string}${'='}${string}`, never> & Record<string, ArgsType>,
  TAliases extends Record<`${'-'}${string}` | `${string}${'='}${string}`, never> & Record<string, keyof TOptions> = {},
>(
  argv: readonly string[],
  options: ArgsOptions<TOptions>,
  aliases: ArgsAliases<keyof TOptions, TAliases> = {} as ArgsAliases<keyof TOptions, TAliases>,
): Args<ArgsOptions<TOptions>> => {
  const argvCopy = [...argv];
  const positional: string[] = [];
  const args: Record<string, any[]> = {};

  for (const [key] of Object.entries(options) as [string, ArgsType][]) {
    args[key] = [];
  }

  let arg: string | undefined;

  while ((arg = argvCopy.shift()) != null) {
    if (arg === '--') {
      positional.push(...argvCopy);
      break;
    }

    const match = arg.match(/^(?<dashes>-{1,2})(?<name>[^=]*)(?:=(?<value>.*))?$/su);

    if (!match?.groups) {
      positional.push(arg);
      continue;
    }

    const dashes = match.groups.dashes;
    let name = match.groups.name;
    let value = match.groups.value as string | undefined;

    if (dashes === '-' && /^.{2}/u.test(name)) {
      const chars = Array.from(name);

      if (chars.length > 1) {
        if (value != null) {
          argvCopy.unshift(value);
        }

        argvCopy.unshift(...chars.filter((char) => char !== '-').map((char) => `-${char}`));
        continue;
      }
    }

    if (!(name in options) && name in aliases) {
      name = (aliases as Record<string, string>)[name];
    }

    if (!(name in options)) {
      throw new Error(`Option ${JSON.stringify(arg)} is unknown`);
    }

    const parse = (options as Record<string, ArgsType>)[name];

    if (parse === Boolean) {
      if (value != null) {
        throw new Error(`Option ${JSON.stringify(arg)} does not accept a value`);
      }

      args[name].push(true);
      continue;
    }

    if (value == null) {
      value = argvCopy.shift();

      if (value == null) {
        throw new Error(`Option ${JSON.stringify(arg)} requires a value`);
      }
    }

    args[name].push(parse(value));
  }

  return {
    get: (key: string) => {
      return args[key].at(-1);
    },
    getAll: (key: string) => {
      return args[key] ?? [];
    },
    getRequired: (key: string) => {
      const values = args[key];
      if (!values?.length) {
        throw new Error(`Missing required argument ${JSON.stringify(key)}`);
      }

      return values;
    },
    has: (key: string) => {
      return args[key]?.length > 0;
    },
    positional,
  } as unknown as Args<ArgsOptions<TOptions>>;
};

export { parseArgs };
