
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

  core.debug(`Removing resolved promises from ${promises.length} promises`);

  const output = new Array<Promise<T>>();

  for (const promise of promises) {

    if (!await isPromiseResolved(promise)) {

      output.push(promise);
    }
  }

  core.debug(`Removed ${promises.length - output.length} resolved promises`);

  promises = output;

  core.debug(`Remaining ${promises.length} promises`);
}