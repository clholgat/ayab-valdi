import "jasmine/src/jasmine";
import { buildBugReportUrl, openExternalUrl } from "constants/src/ExternalLink";

describe("buildBugReportUrl", () => {
  it("links to the bug_report.yml issue form", () => {
    const url = buildBugReportUrl({
      repoUrl: "https://github.com/clholgat/ayab-valdi",
      platform: "Web (browser)",
    });
    expect(url).toContain(
      "https://github.com/clholgat/ayab-valdi/issues/new?",
    );
    expect(url).toContain("template=bug_report.yml");
  });

  it("URL-encodes the platform value", () => {
    const url = buildBugReportUrl({
      repoUrl: "https://github.com/clholgat/ayab-valdi",
      platform: "Web (browser)",
    });
    expect(url).toContain(`platform=${encodeURIComponent("Web (browser)")}`);
  });

  it("omits the environment field when not provided", () => {
    const url = buildBugReportUrl({
      repoUrl: "https://github.com/clholgat/ayab-valdi",
      platform: "Android",
    });
    expect(url).not.toContain("environment=");
  });

  it("includes an encoded environment field when provided", () => {
    const url = buildBugReportUrl({
      repoUrl: "https://github.com/clholgat/ayab-valdi",
      platform: "macOS (native)",
      environment: "AYAB Valdi 0.1.0-dev, macOS 15.0",
    });
    expect(url).toContain(`environment=${encodeURIComponent("AYAB Valdi 0.1.0-dev, macOS 15.0")}`);
  });
});

describe("openExternalUrl", () => {
  it("opens the URL via globalThis.open on web and does not copy to clipboard", () => {
    const opened: string[] = [];
    const copied: string[] = [];
    const originalOpen = (globalThis as any).open;
    (globalThis as any).open = (url: string) => opened.push(url);

    try {
      const result = openExternalUrl(
        "https://example.com/issues/new",
        true,
        (text) => copied.push(text),
      );
      expect(result.opened).toBe(true);
      expect(opened).toEqual(["https://example.com/issues/new"]);
      expect(copied).toEqual([]);
    } finally {
      (globalThis as any).open = originalOpen;
    }
  });

  it("falls back to clipboard on non-web platforms", () => {
    const copied: string[] = [];
    const result = openExternalUrl(
      "https://example.com/issues/new",
      false,
      (text) => copied.push(text),
    );
    expect(result.opened).toBe(false);
    expect(copied).toEqual(["https://example.com/issues/new"]);
  });

  it("falls back to clipboard on web if globalThis.open is unavailable", () => {
    const copied: string[] = [];
    const originalOpen = (globalThis as any).open;
    (globalThis as any).open = undefined;

    try {
      const result = openExternalUrl(
        "https://example.com/issues/new",
        true,
        (text) => copied.push(text),
      );
      expect(result.opened).toBe(false);
      expect(copied).toEqual(["https://example.com/issues/new"]);
    } finally {
      (globalThis as any).open = originalOpen;
    }
  });
});
