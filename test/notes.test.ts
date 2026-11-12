import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.ts";
import { addNote, deleteNote, formatList, formatListColor, NotesError, type Note } from "../src/notes.ts";

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

const COLORED = "\x1b[90m1\x1b[0m. \x1b[32mmilk\x1b[0m (2026-11-06)";

describe("color", () => {
  it("colors one note", () => {
    expect(formatListColor(addNote([], "milk", DAY))).toBe(COLORED);
  });

  it("colors each line separately", () => {
    const notes = addNote(addNote([], "milk", DAY), "eggs", DAY);
    const lines = formatListColor(notes).split("\n");
    expect(lines).toEqual([COLORED, "\x1b[90m2\x1b[0m. \x1b[32meggs\x1b[0m (2026-11-06)"]);
  });

  it("does not color the empty message", () => {
    expect(formatListColor([])).toBe("No notes yet.");
  });

  it("run colors list when color is true", () => {
    const file = tmpFile();
    run(["add", "milk"], file, DAY);
    expect(run(["list"], file, DAY, true)).toEqual({ code: 0, out: COLORED });
  });

  it("run stays plain by default or when color is false", () => {
    const file = tmpFile();
    run(["add", "milk"], file, DAY);
    expect(run(["list"], file, DAY).out).not.toContain("\x1b");
    expect(run(["list"], file, DAY, false).out).not.toContain("\x1b");
  });

  it("keeps formatList plain", () => {
    expect(formatList(addNote([], "milk", DAY))).not.toContain("\x1b");
  });

  it("leaves errors uncolored", () => {
    expect(run(["delete", "3"], tmpFile(), DAY, true)).toEqual({ code: 1, out: "error: no note with id 3" });
  });
});
