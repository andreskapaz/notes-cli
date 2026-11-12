// Notes kept in a JSON file. Pure functions take and return note lists; only load/save touch disk.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export interface Note {
  id: number;
  text: string;
  created: string; // ISO date, YYYY-MM-DD
  tags?: string[];
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

export function normalizeTag(tag: string): string {
  const clean = tag.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,30}$/.test(clean)) {
    throw new NotesError(`invalid tag "${tag}": use 1-30 characters from a-z, 0-9, _ and -`);
  }
  return clean;
}

export function addNote(notes: Note[], text: string, today: string, tags: string[] = []): Note[] {
  const clean = text.trim();
  if (!clean) throw new NotesError("a note needs some text");
  const unique = [...new Set(tags.map(normalizeTag))];
  const id = notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
  const note: Note = { id, text: clean, created: today };
  if (unique.length > 0) note.tags = unique;
  return [...notes, note];
}

export function filterByTag(notes: Note[], tag: string): Note[] {
  const wanted = normalizeTag(tag);
  return notes.filter((n) => n.tags?.includes(wanted));
}

export function deleteNote(notes: Note[], id: number): Note[] {
  if (!notes.some((n) => n.id === id)) throw new NotesError(`no note with id ${id}`);
  return notes.filter((n) => n.id !== id);
}

export function formatList(notes: Note[]): string {
  if (notes.length === 0) return "No notes yet.";
  const tagText = (n: Note) => (n.tags?.length ? ` [${n.tags.join(", ")}]` : "");
  return notes.map((n) => `${n.id}. ${n.text} (${n.created})${tagText(n)}`).join("\n");
}
