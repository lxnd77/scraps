import { describe, expect, it } from "vitest";
import { manualInstall } from "./InstallProvider";

const UA = {
  iosSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  iosFirefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/140.0 Mobile/15E148 Safari/605.1.15",
  firefoxAndroid: "Mozilla/5.0 (Android 15; Mobile; rv:143.0) Gecko/143.0 Firefox/143.0",
  firefoxWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0",
  firefoxMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:143.0) Gecko/20100101 Firefox/143.0",
  chrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
};

describe("manualInstall", () => {
  it.each([
    ["iOS Safari", UA.iosSafari, "ios"],
    ["Firefox on Android", UA.firefoxAndroid, "firefox-android"],
    ["Firefox on Windows", UA.firefoxWindows, "firefox-windows"],
    ["Firefox on macOS", UA.firefoxMac, "firefox-other"],
    // Chrome fires beforeinstallprompt, and Firefox on iOS cannot install at all
    ["Chrome", UA.chrome, null],
    ["Firefox on iOS", UA.iosFirefox, null],
  ])("%s", (_name, ua, expected) => {
    expect(manualInstall(ua, false)).toBe(expected);
  });

  it("offers nothing once installed", () => {
    expect(manualInstall(UA.firefoxAndroid, true)).toBeNull();
  });
});
