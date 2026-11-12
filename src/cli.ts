// notes add <text> | notes list | notes delete <id>. Run with: node src/cli.ts <command>
import {
  addNote,
  deleteNote,
  filterByTag,
  formatList,
  loadNotes,
  normalizeTag,
  NotesError,
  saveNotes,
} from "./notes.ts";

export interface Result {
  code: number;
  out: string;
}

const USAGE = "usage: notes add [--tag <t>]... <text> | notes list [--tag <t>] | notes delete <id>";

export type TagArgs = { tags: string[]; words: string[] } | { usage: true };

export function parseTagArgs(args: string[], multi: boolean): TagArgs {
  const tags: string[] = [];
  const words: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--tag") {
      const value = args[i + 1];
      if (value === undefined || value.startsWith("--")) return { usage: true };
      if (!multi && tags.length > 0) return { usage: true };
      tags.push(value);
      i++;
    } else if (!multi && arg.startsWith("--")) {
      return { usage: true };
    } else {
      words.push(arg);
    }
  }
  return { tags, words };
}

export function run(argv: string[], file: string, today: string): Result {
  const [command, ...rest] = argv;
  try {
    const parsed = command === "add" || command === "list" ? parseTagArgs(rest, command === "add") : undefined;
    if (parsed && "usage" in parsed) return { code: 2, out: USAGE };
    const notes = loadNotes(file);
    if (command === "add" && parsed) {
      const next = addNote(notes, parsed.words.join(" "), today, parsed.tags);
      saveNotes(file, next);
      return { code: 0, out: `Added note ${next[next.length - 1].id}.` };
    }
    if (command === "list" && parsed) {
      if (parsed.tags.length === 0) return { code: 0, out: formatList(notes) };
      const found = filterByTag(notes, parsed.tags[0]);
      const none = `No notes match tag ${normalizeTag(parsed.tags[0])}.`;
      return { code: 0, out: found.length > 0 ? formatList(found) : none };
    }
    if (command === "delete") {
      saveNotes(file, deleteNote(notes, Number(rest[0])));
      return { code: 0, out: `Deleted note ${rest[0]}.` };
    }
    return { code: 2, out: USAGE };
  } catch (err) {
    if (err instanceof NotesError || err instanceof SyntaxError) return { code: 1, out: `error: ${err.message}` };
    throw err;
  }
}

if (import.meta.main) {
  const result = run(process.argv.slice(2), process.env.NOTES_FILE ?? "notes.json", new Date().toISOString().slice(0, 10));
  console.log(result.out);
  process.exitCode = result.code;
}
