import { beforeEach, describe, expect, it, vi } from "vitest";
import { bootModules, resetModules, restartModules } from "./boot.js";

describe("bootModules", () => {
  beforeEach(() => {
    resetModules();
    document.documentElement.removeAttribute("data-modules-ready");
  });

  it("starts modules in list order", async () => {
    const calls = [];
    const modules = [
      { name: "first", init: () => calls.push("first") },
      { name: "second", init: () => calls.push("second") },
    ];

    await bootModules(modules);

    expect(calls).toEqual(["first", "second"]);
    expect(document.documentElement.hasAttribute("data-modules-ready")).toBe(true);
  });

  it("starts the next module after a fault", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const next = vi.fn();
    const modules = [
      { name: "fault", init: () => { throw new Error("fault"); } },
      { name: "next", init: next },
    ];

    await bootModules(modules);

    expect(error).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it("starts the next module after an asynchronous fault", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const next = vi.fn();
    const modules = [
      { name: "fault", init: async () => { throw new Error("fault"); } },
      { name: "next", init: next },
    ];

    await bootModules(modules);

    expect(error).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it("waits for an asynchronous module before starting the next module", async () => {
    const calls = [];
    let finishFirst;
    const firstDone = new Promise((resolve) => {
      finishFirst = resolve;
    });
    const modules = [
      { name: "first", init: async () => { calls.push("first"); await firstDone; } },
      { name: "second", init: () => calls.push("second") },
    ];

    const boot = bootModules(modules);
    await Promise.resolve();

    expect(calls).toEqual(["first"]);

    finishFirst();
    await boot;

    expect(calls).toEqual(["first", "second"]);
  });
});

describe("restartModules", () => {
  beforeEach(() => {
    resetModules();
    document.documentElement.removeAttribute("data-modules-ready");
  });

  it("runs every started module again", async () => {
    const calls = [];
    const modules = [
      { name: "first", init: () => calls.push("first") },
      { name: "second", init: () => calls.push("second") },
    ];

    await bootModules(modules);
    restartModules();

    expect(calls).toEqual(["first", "second", "first", "second"]);
  });

  it("aborts the previous run's signal before starting the next", async () => {
    const seen = [];
    const modules = [
      {
        name: "listener",
        init: (root, { signal }) => {
          const mine = seen.length;
          signal.addEventListener("abort", () => seen.push(mine));
        },
      },
    ];

    await bootModules(modules);
    expect(seen).toEqual([]);

    restartModules();
    expect(seen).toEqual([0]);
  });

  it("hands each run a signal that is not already aborted", async () => {
    const signals = [];
    const modules = [{ name: "thing", init: (root, { signal }) => signals.push(signal) }];

    await bootModules(modules);
    restartModules();

    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it("keeps going when one module throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const calls = [];
    const modules = [
      {
        name: "broken",
        init: () => {
          throw new Error("no");
        },
      },
      { name: "fine", init: () => calls.push("fine") },
    ];

    await bootModules(modules);
    calls.length = 0;
    restartModules();

    expect(calls).toEqual(["fine"]);
    expect(error).toHaveBeenCalled();
  });
});
