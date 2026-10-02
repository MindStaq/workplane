import { describe, expect, it } from "vitest";
import { clockTime, describeCron, duration, formatMs, relativeTime } from "./format";

const NOW = Date.parse("2026-10-02T14:32:00Z");

describe("relativeTime", () => {
  it("formats past and future instants against the given clock", () => {
    expect(relativeTime("2026-10-02T14:31:40Z", NOW)).toBe("just now");
    expect(relativeTime("2026-10-02T14:27:00Z", NOW)).toBe("5m ago");
    expect(relativeTime("2026-10-02T11:32:00Z", NOW)).toBe("3h ago");
    expect(relativeTime("2026-09-30T14:32:00Z", NOW)).toBe("2d ago");
    expect(relativeTime("2026-10-02T14:36:00Z", NOW)).toBe("in 4m");
    expect(relativeTime("2026-10-02T14:32:30Z", NOW)).toBe("in <1m");
  });

  it("shows a dash when there is no timestamp", () => {
    expect(relativeTime(null, NOW)).toBe("—");
  });
});

describe("duration and formatMs", () => {
  it("measures open-ended runs up to now", () => {
    expect(duration("2026-10-02T14:30:00Z", null, NOW)).toBe("2m 0s");
    expect(duration("2026-10-02T14:30:00Z", "2026-10-02T14:30:05Z", NOW)).toBe("5.0s");
    expect(duration(null, null, NOW)).toBe("—");
  });

  it("never reports a negative duration when clocks disagree", () => {
    expect(duration("2026-10-02T14:33:00Z", null, NOW)).toBe("0ms");
  });

  it("scales units", () => {
    expect(formatMs(450)).toBe("450ms");
    expect(formatMs(3_725_000)).toBe("1h 2m");
    expect(formatMs(null)).toBe("—");
  });
});

describe("clockTime and describeCron", () => {
  it("uses UTC so the server and the browser render the same text", () => {
    expect(clockTime("2026-10-02T14:32:09.123Z")).toBe("14:32:09");
  });

  it("describes known cron expressions and falls back for the rest", () => {
    expect(describeCron("*/5 * * * *")).toBe("Every 5 minutes");
    expect(describeCron("7 3 1 * *")).toBe("Custom schedule");
  });
});
