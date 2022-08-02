# parallel-rc

Simply run multiple shell commands in parallel.

## Usage

Create a command file which contains one shell command per line.

Filename: `build.rc`

```
tsc --project tsconfig.build.json
tsc --project tsconfig.types.json
```

Pass the filename to the `parallel-rc` command. The `.rc` extension can be omitted.

```sh
npx parallel-rc build
```

## Command file format

- Blank lines are ignored
- Lines that start with `#` are comments, which are ignored.
- All other lines will be executed as shell commands.

## Command running

- Each command is run in a shell: `/bin/sh` on Unix, `process.env.ComSpec` on Windows.
- Each command is run in parallel, limited to the number of CPU cores + 1 (See the `--concurrency` option).
- Each command's output is prefixed with the command index from the command file (eg. `"0: output line"`).
- If a command fails, the `parallel-rc` exit code will be non-zero, and no new commands will be started (See the `--all` option).

## Options

- `-c, --concurrency <num>`
  - Override the number of parallel commands.
- `-a, --all`
  - Continue running new commands if a commands fails.

