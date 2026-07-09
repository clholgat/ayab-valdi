import "jasmine/src/jasmine";
import { APP_NAME, APP_VERSION } from "constants/src/AppInfo";

describe("AppInfo", () => {
  it("exports app name and version", () => {
    expect(APP_NAME).toContain("AYAB");
    expect(APP_VERSION.length).toBeGreaterThan(0);
  });
});
