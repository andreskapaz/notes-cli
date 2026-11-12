import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run, useColor } from "../src/cli.ts";
import { addNote, deleteNote, formatList, NotesError, type Note } from "../src/notes.ts";

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

describe("color", () => {
  const note: Note = { id: 1, text: "hello", created: "2026-01-01" };
  const colored = "\x1b[90m1.\x1b[39m \x1b[32mhello\x1b[39m (2026-01-01)";

  it("colors id gray and text green, date plain", () => {
    expect(formatList([note], true)).toBe(colored);
  });

  it("colors each line independently", () => {
    expect(formatList([note, { ...note, id: 2 }], true).split("\n")).toHaveLength(2);
    expect(formatList([note, note], true)).toBe(`${colored}\n${colored}`);
  });

  it("is plain when off or by default", () => {
    expect(formatList([note], false)).toBe("1. hello (2026-01-01)");
    expect(formatList([note])).toBe("1. hello (2026-01-01)");
  });

  it("keeps the empty list plain", () => {
    expect(formatList([], true)).toBe("No notes yet.");
    expect(formatList([], false)).toBe("No notes yet.");
  });

  it("decides color from tty and NO_COLOR", () => {
    expect(useColor(true, {})).toBe(true);
    expect(useColor(false, {})).toBe(false);
    expect(useColor(true, { NO_COLOR: "1" })).toBe(false);
    expect(useColor(true, { NO_COLOR: "" })).toBe(true);
  });

  it("run colors only when asked", () => {
    const file = tmpFile();
    run(["add", "x"], file, DAY);
    expect(run(["list"], file, DAY, true).out).toContain("\x1b[32mx\x1b[39m");
    expect(run(["list"], file, DAY).out).toBe("1. x (2026-11-06)");
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
