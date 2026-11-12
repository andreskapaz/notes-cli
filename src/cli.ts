// notes add <text> | notes list | notes delete <id>. Run with: node src/cli.ts <command>
import { addNote, deleteNote, formatList, formatListColor, loadNotes, NotesError, saveNotes } from "./notes.ts";

export interface Result {
  code: number;
  out: string;
}

const USAGE = "usage: notes add <text> | notes list | notes delete <id>";

export function run(argv: string[], file: string, today: string, color = false): Result {
  const [command, ...rest] = argv;
  try {
    const notes = loadNotes(file);
    if (command === "add") {
      const next = addNote(notes, rest.join(" "), today);
      saveNotes(file, next);
      return { code: 0, out: `Added note ${next[next.length - 1].id}.` };
    }
    if (command === "list") return { code: 0, out: color ? formatListColor(notes) : formatList(notes) };
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
  const color = process.stdout.isTTY === true && !("NO_COLOR" in process.env);
  const today = new Date().toISOString().slice(0, 10);
  const result = run(process.argv.slice(2), process.env.NOTES_FILE ?? "notes.json", today, color);
  console.log(result.out);
  process.exitCode = result.code;
}
