type Logger = {
  readonly flush: () => void;
  readonly log: (text: string) => void;
  readonly write: (text: string) => void;
};

type LoggerOptions = {
  readonly decorate?: (text: string) => string;
  readonly onWrite?: (text: string) => void;
  readonly prefix?: string;
};

const createLogger = ({
  prefix = '',
  decorate = (text) => text,
  onWrite = (text) => process.stdout.write(text),
}: LoggerOptions): Logger => {
  let buffer = '';

  const logger: Logger = {
    flush: () => {
      if (buffer) {
        onWrite(prefix + decorate(buffer) + '\n');
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
      lines.forEach((line) => onWrite(prefix + decorate(line) + '\n'));
    },
  };

  return logger;
};

export { createLogger };
