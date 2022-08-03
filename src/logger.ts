type Logger = {
  readonly flush: () => void;
  readonly log: (text: string) => void;
  readonly write: (text: string) => void;
};

type LoggerOptions = {
  readonly prefix?: string;
  readonly wrap?: (line: string) => string;
  readonly write?: ((line: string) => void) | { readonly write: (line: string) => void };
};

const createLogger = ({ prefix = '', wrap = (line) => line, write = process.stdout }: LoggerOptions): Logger => {
  let buffer = '';

  const write_ = typeof write === 'function' ? write : (line: string) => write.write(line);
  const logger: Logger = {
    flush: () => {
      if (buffer) {
        write_(prefix + wrap(buffer) + '\n');
        buffer = '';
      }
    },
    log: (text) => {
      logger.write(text);
      logger.flush();
    },
    write: (text) => {
      const lines = text.split(/\r?\n/);

      lines[0] = buffer + lines[0];
      buffer = lines.pop() ?? '';
      lines.forEach((line) => write_(prefix + wrap(line) + '\n'));
    },
  };

  return logger;
};

export { createLogger };
