type Mediator = {
  readonly flush: () => void;
  readonly next: (count?: number) => void;
  readonly pause: () => void;
  readonly resume: () => void;
};
type Mediated<TArgs extends readonly any[], TReturn> = {
  (...args: TArgs): Promise<TReturn>;
};

const mediate = <TArgs extends readonly unknown[], TReturn>(
  fn: (...args: TArgs) => PromiseLike<TReturn> | TReturn,
): [Mediated<TArgs, TReturn>, Mediator] => {
  const queue: (() => void)[] = [];

  let paused = false;

  const mediated: Mediated<TArgs, TReturn> = async (...args) => {
    if (paused) {
      return new Promise<TReturn>((resolve, reject) => {
        queue.push(() => {
          try {
            resolve(fn(...args));
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    return fn(...args);
  };

  const mediator: Mediator = {
    flush: () => {
      mediator.next(Number.POSITIVE_INFINITY);
    },
    next: (count = 1) => {
      for (let i = 0, max = Math.min(count, queue.length); i < max; ++i) {
        queue.shift()?.();
      }
    },
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
      mediator.flush();
    },
  };

  return [mediated, mediator];
};

export { type Mediated, mediate };
