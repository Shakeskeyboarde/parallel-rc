# parallel-rc

Simply run multiple shell commands in parallel.

## Installation

```sh
npm install --global parallel-rc
```

## Usage

Create a command file which contains one shell command per line.

Filename: `rc-build`

```
tsc --project tsconfig.build.json
tsc --project tsconfig.types.json
```

Run the command file. Optionally, the `rc-` prefix can be omitted, and the `.rc`, `.sh`, `.ps1`, `.cmd`, or `.txt` file extensions can also be omitted.

```sh
rc build
```

You can also use the longer `parallel-rc` command, which is an alias for `rc`.

## Options

- `-a, --all`
  - Run all commands, even if one fails.
- `-c, --concurrency <num>`
  - Limit maximum number of parallel commands.
- `-o, --order`
  - Keep command output together and in order.
- `-s, --shell`
  - Set the shell used to run each command.
- `--color, --no-color`
  - Force color output to be enabled or disabled.

Without an explicit color option, colors are enabled automatically if support is detected (See [supports-colors](https://www.npmjs.com/package/supports-color)).

## Command file format

- A simple shebang-like comment overrides the default shell.
- Blank lines are ignored.
- Lines that start with `#` are comments (which are ignored).
- All other lines will be executed as shell commands.

Examples of simple shebang-like comments:

```
#!/usr/bin/env <shell>
#!<shell>
```

Shebang shell options are not supported.

## Command running

- Commands are run in a shell: `/bin/sh` on Unix, `process.env.ComSpec` on Windows.
- Commands use the command file's directory as the working directory.
- Commands are run in parallel, limited to the number of CPU cores + 1 (See the `--concurrency` option).
- Command output is prefixed with the command index from the command file (eg. `"0: output line"`).
- If a command fails, the `parallel-rc` exit code will be non-zero, and no new commands will be started (See the `--all` option).
