import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.ts";
import { addNote, deleteNote, formatList, formatSearch, NotesError, searchNotes, type Note } from "../src/notes.ts";

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

const sample = (): Note[] => [
  { id: 1, text: "grocery list", created: DAY },
  { id: 2, text: "Buy MILK", created: DAY },
  { id: 5, text: "call mom", created: DAY },
];

describe("search", () => {
  it("returns only matching notes, ignoring case, keeping ids and order", () => {
    expect(searchNotes(sample(), "GROCERY").map((n) => n.id)).toEqual([1]);
    expect(searchNotes(sample(), "milk").map((n) => n.id)).toEqual([2]);
    expect(searchNotes(sample(), "l").map((n) => n.id)).toEqual([1, 2, 5]);
  });

  it("returns empty when nothing matches and does not mutate", () => {
    const notes = sample();
    expect(searchNotes(notes, "zzz")).toEqual([]);
    expect(notes).toEqual(sample());
  });

  it("formats results", () => {
    expect(formatSearch([])).toBe("No matching notes.");
    expect(formatSearch(sample().slice(1, 2))).toBe("2. Buy MILK (2026-11-06)");
  });
});

describe("cli search", () => {
  const seeded = () => {
    const file = tmpFile();
    run(["add", "apple x"], file, DAY);
    run(["add", "banana"], file, DAY);
    return file;
  };

  it("prints only matching lines", () => {
    expect(run(["search", "X"], seeded(), DAY)).toEqual({ code: 0, out: "1. apple x (2026-11-06)" });
  });

  it("joins multiple words", () => {
    expect(run(["search", "apple", "x"], seeded(), DAY).out).toBe("1. apple x (2026-11-06)");
  });

  it("reports no matches with code 0", () => {
    expect(run(["search", "zzz"], seeded(), DAY)).toEqual({ code: 0, out: "No matching notes." });
  });

  it("needs a query", () => {
    const r = run(["search"], seeded(), DAY);
    expect(r.code).toBe(2);
    expect(r.out).toContain("notes search <text>");
    expect(run(["search", "  "], seeded(), DAY).code).toBe(2);
  });

  it("does not modify the file", () => {
    const file = seeded();
    const before = readFileSync(file, "utf8");
    run(["search", "apple"], file, DAY);
    expect(readFileSync(file, "utf8")).toBe(before);
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
