const usage = (): void => {
  console.log(
    `
Usage: parallel-rc <options> <filename> [...<filenames>]
       parallel-rc --version
       parallel-rc --help

Simply run multiple commands in parallel.

Each command in the command file will be run in parallel (limited to the
number of CPU cores + 1). The output from each command is prefixed with the
command index from the command file (eg. "0: output"). All commands are run
to completion even if one or more commands fail. If any commands fail, the
exit code will be non-zero.

NOTE: The '.rc' extension can be omitted from the filename.

Options:
  -h, --help               Display this help text
  -v, --version            Display the current version
  -c, --concurrency <num>  Maximum number of parallel processes
  -a, --all                Run all commands even if one fails
  --color, --no-color      Explicitly enable or disable color output
    `.trim() + '\n',
  );
};

export { usage };
