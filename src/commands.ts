import nodeFs from 'node:fs';
import nodePath from 'node:path';

import { shebang } from './util/shebang.js';

type Command = {
  readonly cwd?: string;
  readonly script: string;
  readonly shell?: string;
};

const loadCommands = async (filenames: readonly string[], signal?: AbortSignal): Promise<Command[]> => {
  const sources = await Promise.all(
    filenames.map(async (filename): Promise<[content: string, cwd: string]> => {
      if (signal?.aborted) {
        return ['', '.'];
      }

      const cwd = nodePath.dirname(nodePath.resolve(filename));
      const base = nodePath.basename(filename);
      const content = await nodeFs.promises
        .readFile(nodePath.join(cwd, base), 'utf8')
        .catch(() => nodeFs.promises.readFile(nodePath.join(cwd, base + '.rc'), 'utf8'))
        .catch(() => nodeFs.promises.readFile(nodePath.join(cwd, base + '.sh'), 'utf8'))
        .catch(() => nodeFs.promises.readFile(nodePath.join(cwd, base + '.ps1'), 'utf8'))
        .catch(() => nodeFs.promises.readFile(nodePath.join(cwd, base + '.cmd'), 'utf8'))
        .catch(() => nodeFs.promises.readFile(nodePath.join(cwd, base + '.txt'), 'utf8'))
        .catch(() => nodeFs.promises.readFile(nodePath.join(cwd, 'rc-' + base), 'utf8'))
        .catch(() => nodeFs.promises.readFile(nodePath.join(cwd, 'rc-' + base + '.rc'), 'utf8'))
        .catch(() => nodeFs.promises.readFile(nodePath.join(cwd, 'rc-' + base + '.sh'), 'utf8'))
        .catch(() => nodeFs.promises.readFile(nodePath.join(cwd, 'rc-' + base + '.ps1'), 'utf8'))
        .catch(() => nodeFs.promises.readFile(nodePath.join(cwd, 'rc-' + base + '.cmd'), 'utf8'))
        .catch(() => nodeFs.promises.readFile(nodePath.join(cwd, 'rc-' + base + '.txt'), 'utf8'))
        .catch(() => {
          throw new Error(`Command file ${JSON.stringify(filename)} not found`);
        });

      return [content, cwd];
    }),
  );

  const commands = sources.reduce<Command[]>((result, source) => {
    const [content, cwd] = source;
    const shell = shebang(content);
    const lines = content.split(/\r?\n/);

    return [
      ...result,
      ...lines
        .map((script) => script.trim())
        .filter((script) => script && !script.startsWith('#'))
        .map((script) => ({ cwd, script, shell } as Command)),
    ];
  }, []);

  return commands;
};

export { type Command, loadCommands };
