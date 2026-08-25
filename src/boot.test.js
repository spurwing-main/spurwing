import { beforeEach, describe, expect, it, vi } from "vitest";
import { bootModules } from "./boot.js";

describe("bootModules", () => {
  beforeEach(() => {
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
