// Notes kept in a JSON file. Pure functions take and return note lists; only load/save touch disk.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export interface Note {
  id: number;
  text: string;
  created: string; // ISO date, YYYY-MM-DD
}

export class NotesError extends Error {}

export function loadNotes(file: string): Note[] {
  if (!existsSync(file)) return [];
  const data: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(data)) throw new NotesError(`${file} does not hold a list of notes`);
  return data as Note[];
}

export function saveNotes(file: string, notes: Note[]): void {
  writeFileSync(file, JSON.stringify(notes, null, 2) + "\n");
}

export function addNote(notes: Note[], text: string, today: string): Note[] {
  const clean = text.trim();
  if (!clean) throw new NotesError("a note needs some text");
  const id = notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
  return [...notes, { id, text: clean, created: today }];
}

export function deleteNote(notes: Note[], id: number): Note[] {
  if (!notes.some((n) => n.id === id)) throw new NotesError(`no note with id ${id}`);
  return notes.filter((n) => n.id !== id);
}

const GRAY = "\x1b[90m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[39m";

export function paint(code: string, s: string, color: boolean): string {
  return color ? `${code}${s}${RESET}` : s;
}

export function formatList(notes: Note[], color = false): string {
  if (notes.length === 0) return "No notes yet.";
  return notes
    .map((n) => `${paint(GRAY, `${n.id}.`, color)} ${paint(GREEN, n.text, color)} (${n.created})`)
    .join("\n");
}
