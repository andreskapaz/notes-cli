import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseTagArgs, run } from "../src/cli.ts";
import {
  addNote,
  deleteNote,
  filterByTag,
  formatList,
  loadNotes,
  NotesError,
  saveNotes,
  type Note,
} from "../src/notes.ts";

const DAY = "2026-11-06";
const tmpFile = () => join(mkdtempSync(join(tmpdir(), "notes-")), "notes.json");
const USAGE = "usage: notes add [--tag <t>]... <text> | notes list [--tag <t>] | notes delete <id>";

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
  it("stores trimmed, lowercased, de-duplicated tags", () => {
    const n = addNote([], "x", DAY, [" A ", "b", "a"])[0];
    expect(n.tags).toEqual(["a", "b"]);
  });

  it("leaves no tags field without tags", () => {
    expect("tags" in addNote([], "x", DAY)[0]).toBe(false);
    expect("tags" in addNote([], "x", DAY, [])[0]).toBe(false);
  });

  it("validates tags", () => {
    for (const bad of ["", "  ", "a b", "a,b", "a!", "x".repeat(31)]) {
      expect(() => addNote([], "x", DAY, [bad])).toThrow(NotesError);
    }
    expect(addNote([], "x", DAY, ["x".repeat(30)])[0].tags).toEqual(["x".repeat(30)]);
    expect(addNote([], "x", DAY, ["a_b-1"])[0].tags).toEqual(["a_b-1"]);
  });

  it("filters by tag", () => {
    const notes = addNote(addNote([], "plain", DAY), "tagged", DAY, ["a"]);
    expect(filterByTag(notes, "A").map((n) => n.text)).toEqual(["tagged"]);
    expect(filterByTag(notes, "zzz")).toEqual([]);
  });

  it("formats tags after the date", () => {
    const notes = addNote(addNote([], "plain", DAY), "t", DAY, ["a", "b"]);
    expect(formatList(notes)).toBe("1. plain (2026-11-06)\n2. t (2026-11-06) [a, b]");
  });

  it("round-trips tags and loads old files", () => {
    const file = tmpFile();
    saveNotes(file, addNote([], "t", DAY, ["a"]));
    expect(loadNotes(file)[0].tags).toEqual(["a"]);
    writeFileSync(file, JSON.stringify([{ id: 1, text: "old", created: DAY }]));
    expect(formatList(loadNotes(file))).toBe("1. old (2026-11-06)");
  });
});

describe("parseTagArgs", () => {
  it("collects tags and words in multi mode", () => {
    expect(parseTagArgs(["--tag", "a", "hello", "--tag", "b"], true)).toEqual({ tags: ["a", "b"], words: ["hello"] });
    expect(parseTagArgs(["hello", "--tag", "a", "world"], true)).toEqual({ tags: ["a"], words: ["hello", "world"] });
  });

  it("flags malformed add arguments", () => {
    expect(parseTagArgs(["--tag"], true)).toEqual({ usage: true });
    expect(parseTagArgs(["--tag", "--tag"], true)).toEqual({ usage: true });
    expect(parseTagArgs(["hello", "--tag", "--x"], true)).toEqual({ usage: true });
  });

  it("handles single-tag mode", () => {
    expect(parseTagArgs(["--tag", "a", "--tag", "b"], false)).toEqual({ usage: true });
    expect(parseTagArgs(["--tag", "a"], false)).toEqual({ tags: ["a"], words: [] });
    expect(parseTagArgs(["--x"], false)).toEqual({ usage: true });
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

  it("adds tagged notes", () => {
    const file = tmpFile();
    expect(run(["add", "hello", "--tag", "a", "world"], file, DAY)).toEqual({ code: 0, out: "Added note 1." });
    run(["add", "--tag", "a", "--tag", "b", "hey"], file, DAY);
    const notes = loadNotes(file);
    expect(notes[0]).toMatchObject({ text: "hello world", tags: ["a"] });
    expect(notes[1].tags).toEqual(["a", "b"]);
  });

  it("returns usage for malformed tag arguments without touching the file", () => {
    const file = tmpFile();
    const cases = [
      ["add", "--tag"],
      ["add", "hello", "--tag", "--tag"],
      ["list", "--tag"],
      ["list", "--tag", "--tag"],
      ["list", "--tag", "a", "--tag", "b"],
    ];
    for (const argv of cases) expect(run(argv, file, DAY)).toEqual({ code: 2, out: USAGE });
    expect(() => readFileSync(file)).toThrow();
  });

  it("rejects invalid tags with code 1", () => {
    const r = run(["add", "--tag", "Bad Tag", "hi"], tmpFile(), DAY);
    expect(r.code).toBe(1);
    expect(r.out.startsWith("error:")).toBe(true);
  });

  it("filters the list by tag", () => {
    const file = tmpFile();
    run(["add", "--tag", "a", "one"], file, DAY);
    run(["add", "two"], file, DAY);
    expect(run(["list", "--tag", "a"], file, DAY).out).toBe("1. one (2026-11-06) [a]");
    expect(run(["list"], file, DAY).out).toBe("1. one (2026-11-06) [a]\n2. two (2026-11-06)");
    expect(run(["list", "--tag", "X"], file, DAY)).toEqual({ code: 0, out: "No notes match tag x." });
  });

  it("keeps tags of other notes on delete", () => {
    const file = tmpFile();
    run(["add", "--tag", "a", "one"], file, DAY);
    run(["add", "two"], file, DAY);
    run(["delete", "2"], file, DAY);
    expect(loadNotes(file)[0].tags).toEqual(["a"]);
  });
});
