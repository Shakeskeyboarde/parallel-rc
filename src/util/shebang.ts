const shebang = (script: string): string | undefined => {
  // eslint-disable-next-line unicorn/no-unsafe-regex
  return script.match(/^#!\s*(?:(?:\S*\/)?env\s+)?(?<shell>\S.*?)\s*?(?:\n|$)/u)?.groups?.shell;
};

export { shebang };
