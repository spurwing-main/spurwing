import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const code = readFileSync("loader.js", "utf8");
const loaderSource = "https://cdn.jsdelivr.net/gh/spurwing-main/spurwing@1234567890abcdef1234567890abcdef12345678/loader.js";

async function runLoader({ source = loaderSource, data = {} } = {}) {
  Object.defineProperty(document, "currentScript", {
    configurable: true,
    value: { src: source, dataset: data },
  });
  window.eval(code);
  for (let step = 0; step < 6; step += 1) await Promise.resolve();
}

describe("loader", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    window.history.replaceState({}, "", "/");
    window.sessionStorage.clear();
    document.querySelectorAll("[data-loader-panel]").forEach((panel) => panel.remove());
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    document.documentElement.className = "";
    delete document.documentElement.dataset.projectNamespace;
    delete window.spurwing;
  });

  it("loads the bundle from the loader commit", async () => {
    window.history.replaceState({}, "", "/?env=live");
    await runLoader();

    const bundle = document.head.querySelector('script[type="module"]');
    expect(bundle.src).toBe(
      "https://cdn.jsdelivr.net/gh/spurwing-main/spurwing@1234567890abcdef1234567890abcdef12345678/dist/bundle.js"
    );
    expect(window.spurwing.boot.commit).toBe("1234567890abcdef1234567890abcdef12345678");
  });

  it("loads no bundle and shows the page when its own address has no commit", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    window.history.replaceState({}, "", "/?env=live");
    await runLoader({ source: "https://example.com/loader.js" });

    expect(document.head.querySelector('script[type="module"]')).toBeNull();
    expect(error).toHaveBeenCalledOnce();
    expect(document.documentElement.classList.contains("spurwing-ready")).toBe(true);
    expect(document.documentElement.classList.contains("spurwing-loading")).toBe(false);
  });

  it.each([
    "https://cdn.jsdelivr.net/gh/spurwing-main/spurwing@main/loader.js",
    "https://cdn.jsdelivr.net/gh/spurwing-main/spurwing@latest/loader.js",
    "https://cdn.jsdelivr.net/gh/spurwing-main/spurwing@1234567/loader.js",
    "https://evil.example/gh/spurwing-main/spurwing@1234567890abcdef1234567890abcdef12345678/loader.js",
  ])("refuses a loader address that is not a full commit on jsDelivr: %s", async (source) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    window.history.replaceState({}, "", "/?env=live");
    await runLoader({ source });

    expect(document.head.querySelector('script[type="module"]')).toBeNull();
    expect(error).toHaveBeenCalledOnce();
    expect(document.documentElement.classList.contains("spurwing-ready")).toBe(true);
  });

  it("logs the local server's error text", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    window.history.replaceState({}, "", "/?env=local");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, text: async () => "The local build failed. x" }));
    await runLoader();

    expect(error).toHaveBeenCalledWith("[loader] The local server returned an error:", "The local build failed. x");
  });

  it("logs the environment and URL when the bundle loads", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    window.history.replaceState({}, "", "/?env=live");
    await runLoader();

    const bundle = document.head.querySelector('script[type="module"]');
    bundle.onload();

    expect(log).toHaveBeenCalledWith("[spurwing] JS bundle loaded", {
      environment: "live",
      source: "live",
      url: bundle.src,
      commit: "1234567890abcdef1234567890abcdef12345678",
    });
  });

  it("ignores a valid commit query and shows the requested dev panel", async () => {
    window.history.replaceState({}, "", "/?dev=1&env=live&commit=abcdef1234567");
    await runLoader();

    const bundle = document.head.querySelector('script[type="module"]');
    expect(bundle.src).toContain("@1234567890abcdef1234567890abcdef12345678/dist/bundle.js");
    expect(document.querySelector("[data-loader-panel]")).not.toBeNull();
    expect(document.querySelector("[data-loader-commit]").textContent).toBe("1234567890");
  });

  it("shows content after the ready timeout", async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/?env=live");
    await runLoader();

    expect(document.documentElement.classList.contains("spurwing-loading")).toBe(true);
    vi.advanceTimersByTime(4000);
    expect(document.documentElement.classList.contains("spurwing-ready")).toBe(true);
    expect(document.documentElement.classList.contains("spurwing-loading")).toBe(false);
  });

  it("uses the live bundle if the local module load fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    window.history.replaceState({}, "", "/?env=local");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await runLoader();

    const localBundle = document.head.querySelector('script[type="module"]');
    expect(localBundle.src).toBe("http://localhost:5500/bundle.js");
    localBundle.onerror();

    const bundles = document.head.querySelectorAll('script[type="module"]');
    expect(bundles).toHaveLength(2);
    expect(bundles[1].src).toContain("@1234567890abcdef1234567890abcdef12345678/dist/bundle.js");
    expect(document.querySelector("[data-loader-status]").textContent).toBe("Local unavailable");
    expect(document.querySelector("[data-loader-source]").textContent).toBe("jsDelivr");
    bundles[1].onerror();
    expect(document.head.querySelectorAll('script[type="module"]')).toHaveLength(2);
  });

  it("does not probe by default even when the local server would respond", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await runLoader();

    expect(fetch).not.toHaveBeenCalled();
    expect(document.head.querySelector('script[type="module"]').src).toBe(loaderSource.replace("/loader.js", "/dist/bundle.js"));
    expect(document.querySelector("[data-loader-panel]")).toBeNull();
  });

  it("hides the panel on staging when the local server does not respond", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await runLoader();

    expect(document.head.querySelector('script[type="module"]').src).toContain(
      "@1234567890abcdef1234567890abcdef12345678/dist/bundle.js"
    );
    expect(document.querySelector("[data-loader-panel]")).toBeNull();
  });

  it("recovers visibility after a failed live bundle without retrying it", async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/?env=live");
    vi.spyOn(console, "error").mockImplementation(() => {});
    await runLoader();
    document.head.querySelector('script[type="module"]').onerror();
    expect(document.head.querySelectorAll('script[type="module"]')).toHaveLength(1);
    vi.advanceTimersByTime(4000);
    expect(document.documentElement.classList.contains("spurwing-ready")).toBe(true);
    expect(document.documentElement.classList.contains("spurwing-loading")).toBe(false);
  });

  it("uses the pinned live bundle when a requested local probe fails", async () => {
    window.history.replaceState({}, "", "/?env=local");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await runLoader();
    expect(document.head.querySelector('script[type="module"]').src).toBe(loaderSource.replace("/loader.js", "/dist/bundle.js"));
  });

  it("reads a stored environment on staging", async () => {
    window.sessionStorage.setItem("spurwing_environment", "live");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await runLoader();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.spurwing.boot.environment).toBe("live");
    expect(document.querySelector("[data-loader-panel]")).not.toBeNull();
  });
});


describe("code source boundaries", () => {
  async function boot({ host = "example.webflow.io", query = "?env=local", data = {}, stored, defaultsBase, defaultsEnvironment } = {}) {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
      url: `https://${host}/${query}`,
      runScripts: "outside-only",
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    dom.window.fetch = fetchMock;
    dom.window.console = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    Object.defineProperty(dom.window.document, "currentScript", {
      value: { src: loaderSource, dataset: data },
    });
    if (stored) dom.window.sessionStorage.setItem("spurwing_environment", stored);
    let source = defaultsBase ? code.replace('localBase: "http://localhost:5500"', `localBase: ${JSON.stringify(defaultsBase)}`) : code;
    if (defaultsEnvironment) source = source.replace('environment: "live"', `environment: ${JSON.stringify(defaultsEnvironment)}`);
    dom.window.eval(source);
    for (let step = 0; step < 8; step += 1) await Promise.resolve();
    const urls = [...dom.window.document.querySelectorAll('script[type="module"]')].map((script) => script.src);
    const config = dom.window.spurwing.boot;
    const panel = Boolean(dom.window.document.querySelector("[data-loader-panel]"));
    dom.window.close();
    return { fetchMock, urls, config, panel };
  }

  it.each(["example.com", "example.webflow.io.attacker.test", "localhost.attacker.test"])(
    "ignores URL and session overrides on %s even with dev enabled", async (host) => {
      const result = await boot({ host, query: "?dev=1&env=local&local=https://attacker.test&commit=abcdef1234567", stored: "local" });
      expect(result.fetchMock).not.toHaveBeenCalled();
      expect(result.urls).toEqual([loaderSource.replace("/loader.js", "/dist/bundle.js")]);
      expect(result.config.environment).toBe("live");
      expect(result.panel).toBe(false);
    }
  );

  it.each(["?mode=dev&env=local", "?dev=1&commit=abcdef1234567", "?dev=1", ""])(
    "keeps the pinned production bundle for %s and stored local mode", async (query) => {
      const result = await boot({ host: "example.com", query, stored: "local", data: { localBase: "https://trusted-tunnel.example" } });
      expect(result.fetchMock).not.toHaveBeenCalled();
      expect(result.urls).toEqual([loaderSource.replace("/loader.js", "/dist/bundle.js")]);
      expect(result.panel).toBe(false);
    }
  );

  it.each(["example.com", "example.webflow.io", "localhost"])(
    "ignores all commit query values on %s", async (host) => {
      for (const ref of ["abcdef1234567", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "../../other/repo@main", "main/../../evil", "refs/heads/fork"] ) {
        const result = await boot({ host, query: `?dev=1&commit=${encodeURIComponent(ref)}` });
        expect(result.fetchMock).not.toHaveBeenCalled();
        expect(result.urls).toEqual([loaderSource.replace("/loader.js", "/dist/bundle.js")]);
        expect(result.config.commit).toBe("1234567890abcdef1234567890abcdef12345678");
      }
    }
  );

  it.each(["", "?env=auto", "?env=live", "?dev=1", "?mode=dev"])(
    "does not probe without an explicit Local choice: %s", async (query) => {
      const result = await boot({ query });
      expect(result.fetchMock).not.toHaveBeenCalled();
      expect(result.urls).toEqual([loaderSource.replace("/loader.js", "/dist/bundle.js")]);
    }
  );

  it("preserves an explicit trusted Local default", async () => {
    const result = await boot({ query: "", defaultsEnvironment: "local" });
    expect(result.fetchMock).toHaveBeenCalledOnce();
    expect(result.urls).toEqual(["http://localhost:5500/bundle.js"]);
  });

  it("still probes after a tab's explicit panel Local selection", async () => {
    const result = await boot({ query: "", stored: "local" });
    expect(result.fetchMock).toHaveBeenCalledOnce();
    expect(result.urls).toEqual(["http://localhost:5500/bundle.js"]);
  });

  it("does not accept a lookalike of a configured tunnel", async () => {
    const result = await boot({ data: { localBase: "https://trusted-tunnel.example" }, query: "?env=local&local=https://trusted-tunnel.example.attacker.test" });
    expect(result.urls).toEqual(["https://trusted-tunnel.example/bundle.js"]);
  });

  it.each([
    "https://attacker.test", "javascript://localhost/alert(1)", "ftp://localhost:5500",
    "http://localhost.attacker.test:5500", "https://trusted-tunnel.example.attacker.test",
    "http://user:pass@localhost:5500", "http://localhost:5500?", "http://localhost:5500#", "//localhost:5500", "/local", "not a URL",
  ])("does not fetch or execute the untrusted base %s", async (base) => {
    const result = await boot({ query: `?env=local&local=${encodeURIComponent(base)}` });
    expect(result.fetchMock).toHaveBeenCalledWith("http://localhost:5500/bundle.js", expect.any(Object));
    expect(result.urls).toEqual(["http://localhost:5500/bundle.js"]);
  });

  it.each(["http://localhost:5501", "http://127.0.0.1:5501", "http://[::1]:5501"])(
    "allows loopback %s on staging", async (base) => {
      const result = await boot({ query: `?env=local&local=${encodeURIComponent(base)}` });
      expect(result.urls).toEqual([`${base}/bundle.js`]);
    }
  );

  it.each(["localhost", "127.0.0.1", "[::1]"])("allows development on %s", async (host) => {
    const result = await boot({ host });
    expect(result.urls).toEqual(["http://localhost:5500/bundle.js"]);
  });

  it.each(["script", "defaults"])("allows an explicitly configured tunnel from %s", async (owner) => {
    const tunnel = "https://trusted-tunnel.example";
    const result = await boot(owner === "script" ? { data: { localBase: tunnel } } : { defaultsBase: tunnel });
    expect(result.urls).toEqual([`${tunnel}/bundle.js`]);
  });

  it("allows a query path on the configured tunnel origin", async () => {
    const result = await boot({ data: { localBase: "https://trusted-tunnel.example" }, query: "?env=local&local=https://trusted-tunnel.example/dev" });
    expect(result.urls).toEqual(["https://trusted-tunnel.example/dev/bundle.js"]);
  });

  it.each(["javascript://localhost/evil", "https://user:pass@trusted-tunnel.example", "ftp://localhost", "https://trusted-tunnel.example?", "https://trusted-tunnel.example#"])(
    "rejects invalid configured bases without a local request: %s", async (base) => {
      const result = await boot({ data: { localBase: base }, defaultsBase: base });
      expect(result.fetchMock).not.toHaveBeenCalled();
      expect(result.urls).toEqual([loaderSource.replace("/loader.js", "/dist/bundle.js")]);
    }
  );
});
