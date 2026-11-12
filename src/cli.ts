// notes add <text> | notes list | notes delete <id>. Run with: node src/cli.ts <command>
import { addNote, deleteNote, filterByTag, formatList, loadNotes, NotesError, saveNotes } from "./notes.ts";

export interface Result {
  code: number;
  out: string;
}

const USAGE = "usage: notes add [--tag <tag>]... <text> | notes list [--tag <tag>] | notes delete <id>";

function parseTags(args: string[]): { tags: string[]; words: string[] } | undefined {
  const tags: string[] = [];
  const words: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== "--tag") {
      words.push(args[i]);
      continue;
    }
    if (i + 1 >= args.length) return undefined;
    tags.push(args[++i]);
  }
  return { tags, words };
}

export function run(argv: string[], file: string, today: string): Result {
  const [command, ...rest] = argv;
  try {
    const notes = loadNotes(file);
    if (command === "add" || command === "list") {
      const parsed = parseTags(rest);
      if (!parsed) return { code: 2, out: USAGE };
      if (command === "add") {
        const next = addNote(notes, parsed.words.join(" "), today, parsed.tags);
        saveNotes(file, next);
        return { code: 0, out: `Added note ${next[next.length - 1].id}.` };
      }
      if (parsed.tags.length === 0) return { code: 0, out: formatList(notes) };
      const found = filterByTag(notes, parsed.tags[0]);
      return { code: 0, out: found.length ? formatList(found) : "No notes match." };
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
