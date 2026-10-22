import { describe, expect, it } from "vitest";
import { RawEventSchema } from "../src/index.js";

describe("event record schema", () => {
  const event = { tick: 0, type: "test", actors: [], place: "hall" };

  it("keeps optional arbitrary string-keyed event data", () => {
    expect(RawEventSchema.parse(event)).toEqual(event);
    const data = { amount: 3, details: { active: true }, absent: null };
    expect(RawEventSchema.parse({ ...event, data }).data).toEqual(data);
  });

  it("rejects an array in place of an event record", () => {
    expect(RawEventSchema.safeParse({ ...event, data: [] }).success).toBe(false);
  });
});
