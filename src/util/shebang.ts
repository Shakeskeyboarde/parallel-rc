const shebang = (script: string): string | undefined => {
  return script.match(/^#!\s*(?:(?:\S*\/)?env\s+)?(?<shell>\S.*?)\s*?(?:\n|$)/u)?.groups?.shell;
};

export { shebang };
