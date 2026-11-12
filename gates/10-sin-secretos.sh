#!/usr/bin/env bash
# gates/10-sin-secretos.sh — frena la corrida si el cambio de los agentes agrega algo que parece un secreto.
# Solo revisa las líneas AGREGADAS del diff: lo que ya estaba en el repo (como el token del tablero en
# factory.conf) nunca frena una corrida. Nunca imprime el secreto: lo que imprime este gate termina en el PR.
set -uo pipefail
base="${FACTORY_BASE:?FACTORY_BASE no está definido}"
changed="${FACTORY_CHANGED:-}"
found=""

# Archivos que por su nombre son credenciales (.env, llaves, certificados). .env.example sí se permite.
files="$(grep -E '(^|/)\.env(\.[^/]*)?$|\.(pem|key|p12|pfx|jks)$|(^|/)id_(rsa|ed25519|ecdsa)$' <<<"$changed" \
  | grep -vE '\.env\.(example|sample|template)$' || true)"
while IFS= read -r f; do
  [ -n "$f" ] && [ -e "$f" ] && found="$found  $f  (archivo de credenciales)"$'\n'
done <<<"$files"

# Cada línea agregada como "archivo<TAB>línea<TAB>contenido".
added="$(git -c core.quotepath=off diff -U0 --no-renames --no-color "$base" -- . | awk '
  /^--- /                { hdr = 1; next }
  hdr && /^\+\+\+ /      { f = substr($0, 7); hdr = 0; next }
  /^@@/                  { split($3, a, ","); n = substr(a[1], 2) + 0; next }
  /^\+/                  { print f "\t" n "\t" substr($0, 2); n++ }
')"

check() {  # check <descripción> <regex> [-i]: anota archivo:línea de cada línea agregada que coincide
  local hits
  hits="$(cut -f3- <<<"$added" | grep -n ${3:-} -E -- "$2" | cut -d: -f1 || true)"
  local i
  for i in $hits; do
    found="$found  $(sed -n "${i}p" <<<"$added" | cut -f1,2 | tr '\t' ':')  ($1)"$'\n'
  done
}

if [ -n "$added" ]; then
  check "llave privada"        '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  check "token de GitHub"      'gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,}'
  check "API key de Anthropic" 'sk-ant-[A-Za-z0-9_-]{20,}'
  check "API key tipo sk-"     'sk-(proj-)?[A-Za-z0-9]{20,}'
  check "llave de AWS"         '(AKIA|ASIA)[0-9A-Z]{16}'
  check "API key de Google"    'AIza[0-9A-Za-z_-]{35}'
  check "token de Slack"       'xox[abposr]-[A-Za-z0-9-]{10,}'
  check "JWT"                  'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.'
  check "credencial en el código" \
    '(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret)["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"'][^"'"'"'[:space:]]{8,}["'"'"']' -i
fi

if [ -n "$found" ]; then
  echo "El cambio agrega algo que parece un secreto (no lo muestro aquí):"
  printf '%s' "$found" | sort -u
  echo "Los secretos van en variables de entorno, nunca en el repo. Si es un falso positivo, lo decide una persona."
  exit 1
fi
echo "Sin secretos en el cambio."
