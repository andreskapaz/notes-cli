import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.ts";
import { addNote, deleteNote, filterByTag, formatList, NotesError, type Note } from "../src/notes.ts";

const DAY = "2026-11-06";
const tmpFile = () => join(mkdtempSync(join(tmpdir(), "notes-")), "notes.json");

describe("notes", () => {
  it("adds a note with the next id", () => {
    const notes = addNote(addNote([], "first", DAY), "second", DAY);
    expect(notes.map((n) => n.id)).toEqual([1, 2]);
  });

  it("trims text and refuses empty notes", () => {
    expect(addNote([], "  hi  ", DAY)[0].text).toBe("hi");
    expect(() => addNote([], "   ", DAY)).toThrow(NotesError);
  });

  it("deletes by id and refuses unknown ids", () => {
    const notes: Note[] = addNote([], "a", DAY);
    expect(deleteNote(notes, 1)).toEqual([]);
    expect(() => deleteNote(notes, 9)).toThrow("no note with id 9");
  });

  it("formats a list", () => {
    expect(formatList([])).toBe("No notes yet.");
    expect(formatList(addNote([], "milk", DAY))).toBe("1. milk (2026-11-06)");
  });
});

describe("tags", () => {
  it("stores normalized tags", () => {
    const n = addNote([], "x", DAY, [" Work ", "URGENT", "work"])[0];
    expect(n.tags).toEqual(["work", "urgent"]);
  });

  it("leaves untagged notes unchanged", () => {
    expect(addNote([], "x", DAY)[0]).toEqual({ id: 1, text: "x", created: DAY });
  });

  it("rejects blank tags", () => {
    expect(() => addNote([], "x", DAY, ["  "])).toThrow(NotesError);
  });

  it("filters by tag", () => {
    const notes = addNote(addNote([], "a", DAY, ["work"]), "b", DAY);
    expect(filterByTag(notes, "WORK").map((n) => n.text)).toEqual(["a"]);
    expect(filterByTag(notes, "nope")).toEqual([]);
  });

  it("formats tags", () => {
    const notes = addNote(addNote([], "a", DAY, ["x", "y"]), "b", DAY);
    expect(formatList(notes)).toBe("1. a [x, y] (2026-11-06)\n2. b (2026-11-06)");
  });
});

describe("cli tags", () => {
  it("adds tagged notes and filters", () => {
    const file = tmpFile();
    run(["add", "--tag", "work", "--tag", "urgent", "buy", "milk"], file, DAY);
    run(["add", "other"], file, DAY);
    expect(run(["list"], file, DAY).out).toBe("1. buy milk [work, urgent] (2026-11-06)\n2. other (2026-11-06)");
    expect(run(["list", "--tag", "work"], file, DAY).out).toBe("1. buy milk [work, urgent] (2026-11-06)");
    expect(run(["list", "--tag", "zzz"], file, DAY).out).toBe("No notes match.");
  });

  it("requires a tag value", () => {
    expect(run(["add", "x", "--tag"], tmpFile(), DAY).code).toBe(2);
    expect(run(["list", "--tag"], tmpFile(), DAY).code).toBe(2);
  });
});

describe("cli", () => {
  it("adds and lists notes in the file", () => {
    const file = tmpFile();
    expect(run(["add", "buy", "milk"], file, DAY)).toEqual({ code: 0, out: "Added note 1." });
    expect(run(["list"], file, DAY).out).toBe("1. buy milk (2026-11-06)");
  });

  it("deletes a note", () => {
    const file = tmpFile();
    run(["add", "x"], file, DAY);
    expect(run(["delete", "1"], file, DAY).code).toBe(0);
    expect(run(["list"], file, DAY).out).toBe("No notes yet.");
  });

  it("reports errors with exit code 1", () => {
    const file = tmpFile();
    writeFileSync(file, "{ not json");
    expect(run(["list"], file, DAY).code).toBe(1);
    expect(run(["delete", "3"], tmpFile(), DAY)).toEqual({ code: 1, out: "error: no note with id 3" });
  });

  it("prints usage for unknown commands", () => {
    expect(run(["fly"], tmpFile(), DAY).code).toBe(2);
  });
});
