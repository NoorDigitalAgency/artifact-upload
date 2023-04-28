export async function delay (ms: number) {

  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export function promiser<T>() {

  let resolve: (value: (T | PromiseLike<T>)) => void = _ => {};

  let reject: (reason?: any) => void = _ => {};

  const promise = new Promise<T>((innerResolve, innerReject) => {

    resolve = innerResolve;

    reject = innerReject;
  });

  return {promise, resolve, reject};
}