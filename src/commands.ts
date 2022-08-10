import nodeFs from 'node:fs';

import { shebang } from './util/shebang.js';

type Command = {
  readonly script: string;
  readonly shell?: string;
};

const loadCommands = async (filenames: readonly string[], signal?: AbortSignal): Promise<Command[]> => {
  const contents = await Promise.all(
    filenames.map(async (filename) => {
      if (signal?.aborted) {
        return '';
      }

      try {
        return await nodeFs.promises.readFile(filename + '.rc', 'utf8');
      } catch (err) {
        return await nodeFs.promises.readFile(filename, 'utf8');
      }
    }),
  );

  const commands = contents.reduce<Command[]>((result, content) => {
    const shell = shebang(content);
    const lines = content.split(/\r?\n/);

    return lines
      .map((script) => script.trim())
      .filter((script) => script && !script.startsWith('#'))
      .map((script) => ({ script, shell }));
  }, []);

  return commands;
};

export { type Command, loadCommands };
