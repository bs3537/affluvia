import fs from "fs/promises";
import path from "path";
import { generateWillDocuments } from "../services/will/renderer";

describe("will generator", () => {
  const baseDir = path.join(process.cwd(), "uploads", "test-wills");

  it("writes the expected HTML files", async () => {
    const dir = path.join(baseDir, `test-${Date.now()}`);
    const form = {
      person: { first: "Test", last: "User", city: "Andover", state: "MA" },
      maritalStatus: "married",
      spouse: { name: "Spouse User" },
      children: [{ name: "Child One", isMinor: true }],
      executors: [{ name: "Spouse User" }],
      digitalExecutor: { useSame: true, accessComms: true },
      residuary: { primary: { slices: [{ kind: "person", name: "Spouse User", percent: 100 }] }, takersOfLastResort: "heirs" },
      gifts: [],
      provisions: { independentAdmin: true, noContest: true, selfProving: true, nonprofitConsent: false, includeSpecialNeedsTrust: true },
      funeral: { agents: ["Spouse User"] },
      messages: [],
    } as any;

    const files = await generateWillDocuments(dir, form);
    const kinds = files.map((f) => f.kind).sort();
    expect(kinds).toEqual([
      "beneficiary-messages",
      "digital-assets",
      "funeral-wishes",
      "instructions",
      "last-will-and-testament",
      "personal-property-memo",
      "self-proving-affidavit",
    ].sort());

    // Check that at least the will file exists
    const will = files.find((f) => f.kind === "last-will-and-testament");
    expect(will).toBeTruthy();
    const content = await fs.readFile(will!.filePath, "utf8");
    expect(content).toContain("Last Will and Testament of Test User");
  });
});
