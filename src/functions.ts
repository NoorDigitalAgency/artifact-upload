
import * as core from '@actions/core';

enum PromiseState {
  Pending = "pending",
  Fulfilled = "fulfilled",
  Rejected = "rejected"
}

function promiseState(promise: Promise<any>): Promise<PromiseState> {

  const pending = {};

  return Promise.race([promise, pending]).then(value => (value === pending)? PromiseState.Pending : PromiseState.Fulfilled, () => PromiseState.Rejected);
}

function isPromiseResolved(promise: Promise<any>): Promise<boolean> {

  return promiseState(promise).then(state => state !== PromiseState.Pending);
}

export async function removeResolved<T> (promises: Promise<T>[]) {

  const output = new Array<Promise<T>>();

  for (const promise of promises) {

    if (!await isPromiseResolved(promise)) {

      output.push(promise);
    }
  }

  for (const resolved of output) {

    promises.slice(promises.indexOf(resolved), 1);
  }

  output.length = 0;
}