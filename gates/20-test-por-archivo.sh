#!/usr/bin/env bash
# gates/20-test-por-archivo.sh — cada archivo de código que los agentes cambien en src/ necesita un test:
# un archivo de test/ que también cambió en esta corrida (con al menos una línea nueva) y que lo importa.
# Un archivo de src/ borrado no necesita test.
set -uo pipefail
base="${FACTORY_BASE:?FACTORY_BASE no está definido}"
changed="${FACTORY_CHANGED:-}"

code="$(grep -E '^src/.+\.(m|c)?[jt]sx?$' <<<"$changed" || true)"
[ -n "$code" ] || { echo "No cambió código en src/."; exit 0; }

# Los tests que siguen existiendo y ganaron al menos una línea no vacía en esta corrida.
tests=""
while IFS= read -r t; do
  [ -n "$t" ] && [ -f "$t" ] || continue
  if git diff "$base" -- "$t" | grep -vE '^\+\+\+ ' | grep -qE '^\+.*[^[:space:]]'; then tests="$tests$t"$'\n'; fi
done < <(grep -E '^test/.+\.(test|spec)\.(m|c)?[jt]sx?$' <<<"$changed" || true)

missing=""
while IFS= read -r f; do
  [ -f "$f" ] || continue  # borrado: no hay nada que probar
  stem="${f#src/}"
  stem="${stem%.*}"
  stem="$(sed 's/[.[\*^$()+?{}|]/\\&/g' <<<"$stem")"  # escapa el nombre para la regex
  ok=""
  while IFS= read -r t; do
    [ -n "$t" ] || continue
    # un import de este archivo, por ejemplo "../src/notes.ts" (con o sin extensión)
    if grep -qE "[\"'](\.\.?/)+src/${stem}(\.(m|c)?[jt]sx?)?[\"']" "$t"; then ok=1; break; fi
  done <<<"$tests"
  [ -n "$ok" ] || missing="$missing  $f"$'\n'
done <<<"$code"

if [ -n "$missing" ]; then
  echo "Estos archivos de código cambiaron sin un test que los cubra:"
  printf '%s' "$missing"
  echo "Cada archivo de src/ que cambie necesita un test en test/ que lo importe y que también cambie en esta corrida."
  exit 1
fi
echo "Cada archivo de src/ que cambió tiene su test."
