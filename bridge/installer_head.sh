#!/bin/bash
# Beyder&Co. Realty Agent Office — verified, reversible, office-only installation.
# Payload is verified and staged before this separate launch agent is stopped.
set -uo pipefail
LABEL="__LABEL__"
APP="$HOME/Library/Application Support/bco-agent-office"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
PY="/usr/bin/python3"
PORT="${BCO_OFFICE_PORT:-4317}"
URL="http://127.0.0.1:$PORT/"
DOMAIN="gui/$(id -u)"
SELF="${BASH_SOURCE[0]}"
LOCK="$HOME/Library/Application Support/.bco-agent-office-install.lock"
WORK=""; BK=""; MUTATED=0; COMMITTED=0; WAS_LOADED=0
say() { printf '%s\n' "$*"; }
ok() { printf '  ✓ %s\n' "$*"; }
fail() { printf '\n  ✗ %s\n\n' "$*" >&2; exit 1; }
[ "$(uname)" = Darwin ] || fail "Run this on the Mac Studio."
[ -f "$SELF" ] || fail "Run the saved installer file with bash."
[ -x "$PY" ] || fail "$PY is missing. Install the Xcode Command Line Tools first."
case "$LABEL" in *beyderco*|*[!A-Za-z0-9.-]*|'') fail "Invalid office label; fleet namespace forbidden.";; esac
case "$PORT" in *[!0-9]*|'') fail "Port must be numeric.";; esac
[ "$PORT" -ge 1 ] && [ "$PORT" -le 65535 ] || fail "Port is out of range."

# A lock outside APP survives uninstall moves. A live or incomplete owner fails closed.
mkdir -p "$(dirname "$LOCK")" || fail "Cannot create the install-lock parent."
if ! mkdir "$LOCK" 2>/dev/null; then
  OWNER=$(cat "$LOCK/pid" 2>/dev/null || true)
  case "$OWNER" in *[!0-9]*|'') fail "Another installation owns an incomplete lock: $LOCK";; esac
  kill -0 "$OWNER" 2>/dev/null && fail "Another office installation is running (PID $OWNER)."
  rm -f "$LOCK/pid" && rmdir "$LOCK" && mkdir "$LOCK" || fail "Cannot recover the old office install lock."
fi
printf '%s\n' "$$" > "$LOCK/pid"

verify_health() {
  local file="$1" version="$2" build="$3" page="$4"
  "$PY" -I -S -B -c 'import json,sys;d=json.load(open(sys.argv[1]));sys.exit(0 if d.get("ok") is True and ((d.get("readOnly") is False and d.get("sourceReadOnly") is True and d.get("commandMode")=="existing_chat_queue") if sys.argv[2]=="__VERSION__" else d.get("readOnly") is True) and d.get("version")==sys.argv[2] and (not sys.argv[3] or d.get("buildId")==sys.argv[3]) and (not sys.argv[4] or d.get("pageVersion")==sys.argv[4]) else 1)' "$file" "$version" "$build" "$page"
}
# launchd can finish bootout asynchronously. Never replace files while the old
# office remains registered or still owns its port; retry only this own label.
office_loaded() { launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; }
stop_office() {
  launchctl bootout "$DOMAIN/$LABEL" >/dev/null 2>&1 || true
  local attempt
  for attempt in $(seq 1 40); do
    if ! office_loaded && ! lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  say "The office did not finish unloading within 40 seconds." >&2
  return 1
}
start_office() {
  local attempt
  # A removed launchd service may briefly reject bootstrap with error 5 even
  # after disappearing from print. Preserve the error, but allow bounded recovery.
  for attempt in $(seq 1 20); do
    if launchctl bootstrap "$DOMAIN" "$PLIST" > "$WORK/launchd-start.log" 2>&1; then return 0; fi
    # Some failures leave the requested service registered. Exact health below
    # decides whether that process is the expected release; never bootstrap twice.
    if office_loaded; then return 0; fi
    [ "$attempt" -eq 20 ] || sleep 2
  done
  cat "$WORK/launchd-start.log" >&2
  say "The office could not be registered after 20 startup attempts." >&2
  return 1
}
rollback() {
  say "Installation did not finish. Restoring the previous office release …"
  stop_office || return 1
  local item
  for item in bridge.py office.html MANIFEST.sha256 vendor; do
    rm -rf "$APP/$item" || return 1
    if [ -e "$BK/$item" ]; then cp -pR "$BK/$item" "$APP/$item" || return 1; fi
  done
  if [ -f "$BK/launch-agent.plist" ]; then
    cp -p "$BK/launch-agent.plist" "$PLIST" || return 1
  else
    rm -f "$PLIST" || return 1
  fi
  if [ -f "$BK/state.json" ]; then
    cp -p "$BK/state.json" "$APP/private/state.json" || return 1
  else
    rm -f "$APP/private/state.json" || return 1
  fi
  # Compare every restored payload byte before claiming rollback success.
  "$PY" -I -S -B - "$BK" "$APP" "$PLIST" <<'PY'
import hashlib,json,pathlib,sys
backup,app,plist=map(pathlib.Path,sys.argv[1:])
expected=json.loads((backup/'rollback-files.json').read_text())
actual={}
for name in ('bridge.py','office.html','MANIFEST.sha256','vendor'):
    p=app/name
    if p.is_file():actual[name]=hashlib.sha256(p.read_bytes()).hexdigest()
    elif p.is_dir():
        for f in p.rglob('*'):
            if f.is_file():actual[str(f.relative_to(app))]=hashlib.sha256(f.read_bytes()).hexdigest()
if plist.exists():actual['@launch-agent']=hashlib.sha256(plist.read_bytes()).hexdigest()
if (app/'private/state.json').exists():actual['@state']=hashlib.sha256((app/'private/state.json').read_bytes()).hexdigest()
if actual!=expected:raise SystemExit('Restored office bytes do not match the saved release')
PY
  [ $? -eq 0 ] || return 1
  if [ "$WAS_LOADED" -eq 1 ] && [ -f "$PLIST" ]; then
    start_office || return 1
    if [ -s "$BK/previous-health.json" ]; then
      local prior
      prior=$("$PY" -I -S -B -c 'import json,sys;d=json.load(open(sys.argv[1]));print(d.get("version",""));print(d.get("buildId",""));print(d.get("pageVersion",""))' "$BK/previous-health.json") || return 1
      local pv pb pp
      pv=$(printf '%s\n' "$prior" | sed -n '1p'); pb=$(printf '%s\n' "$prior" | sed -n '2p'); pp=$(printf '%s\n' "$prior" | sed -n '3p')
      local restored=0
      for _ in $(seq 1 30); do
        if curl -fsS --max-time 2 "${URL}health" > "$WORK/restored-health.json" 2>/dev/null && verify_health "$WORK/restored-health.json" "$pv" "$pb" "$pp"; then restored=1; break; fi
        sleep 1
      done
      [ "$restored" -eq 1 ] || return 1
    fi
  fi
  ok "Previous office restored; decision ledger preserved. Rollback copy: $BK"
}
cleanup() {
  local rc=$?
  trap - EXIT INT TERM HUP
  if [ "$MUTATED" -eq 1 ] && [ "$COMMITTED" -eq 0 ]; then
    if ! rollback; then say "ROLLBACK NEEDS ATTENTION. Exact previous files remain at $BK" >&2; fi
    rc=1
  fi
  [ -z "$WORK" ] || rm -rf "$WORK"
  rm -f "$LOCK/pid"; rmdir "$LOCK" 2>/dev/null || true
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

if [ "${1:-}" = --uninstall ]; then
  say "Removing the Agent Office bridge by preserving it in Backups …"
  stop_office || fail "Cannot safely remove an office that is still unloading."
  BK=$(mktemp -d "$HOME/Backups/bco-agent-office-removed-XXXXXXXX" 2>/dev/null) || {
    mkdir -p "$HOME/Backups" || fail "Cannot create Backups."
    BK=$(mktemp -d "$HOME/Backups/bco-agent-office-removed-XXXXXXXX") || fail "Cannot create removal backup."
  }
  if [ -e "$PLIST" ]; then mv "$PLIST" "$BK/" || fail "Cannot preserve the launch agent."; fi
  if [ -e "$APP" ]; then mv "$APP" "$BK/app" || fail "Cannot preserve the office and ledger."; fi
  ok "Office and decision ledger retained at $BK"
  exit 0
fi

say "Beyder&Co. Realty Agent Office: staging bridge __VERSION__"
FLEET_LIST=$(launchctl list 2>/dev/null) || fail "Cannot read the fleet census; nothing was changed."
FLEET_LABELS_BEFORE=$(printf '%s\n' "$FLEET_LIST" | awk '$3 ~ /^com\.beyderco\./ {print $3}' | sort)
if printf '%s\n' "$FLEET_LIST" | awk -v label="$LABEL" '$3 == label {found=1} END {exit !found}'; then WAS_LOADED=1; fi
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  [ "$WAS_LOADED" -eq 1 ] || fail "The port is occupied without this office launch agent. Nothing was changed."
fi
WORK=$(mktemp -d "${TMPDIR:-/tmp}/bco-office.XXXXXX") || fail "Cannot create a staging folder."
LINE=$(awk '/^__PAYLOAD_BELOW__$/ {print NR+1;exit}' "$SELF")
[ -n "$LINE" ] || fail "The installer payload is missing."
tail -n +"$LINE" "$SELF" | base64 -D 2>/dev/null | tar -xzf - -C "$WORK" 2>/dev/null || fail "Cannot unpack the installer payload."
[ -f "$WORK/bridge.py" ] && [ -f "$WORK/office.html" ] || fail "The payload is incomplete."
[ "$(shasum -a 256 "$WORK/MANIFEST.sha256" | awk '{print $1}')" = "__PAYLOAD_SHA__" ] || fail "Payload manifest checksum mismatch."
(cd "$WORK" && shasum -a 256 -c MANIFEST.sha256 >/dev/null) || fail "Payload checksum failed."
"$PY" -I -S -B -c 'from pathlib import Path;import sys;compile(Path(sys.argv[1]).read_text(),sys.argv[1],"exec")' "$WORK/bridge.py" || fail "Candidate bridge does not compile on system Python."
"$PY" -I -S -B - "$WORK/launch-agent.plist" "$LABEL" "$PY" "$APP" <<'PY'
import pathlib,plistlib,sys
out,label,python,app=sys.argv[1:]
d={'Label':label,'ProgramArguments':[python,'-I','-S','-B',app+'/bridge.py'],'WorkingDirectory':app,'RunAtLoad':True,'KeepAlive':True,'ThrottleInterval':30,'ProcessType':'Standard','StandardOutPath':app+'/logs/launchd.out.log','StandardErrorPath':app+'/logs/launchd.err.log'}
pathlib.Path(out).write_bytes(plistlib.dumps(d))
PY
plutil -lint "$WORK/launch-agent.plist" >/dev/null || fail "Candidate launch agent is invalid."
ok "Payload, Python syntax and launch agent verified before installation"
# Read-only source preflight uses existing config. Source unavailability is displayed by the office.
"$PY" -I -S -B "$WORK/bridge.py" --check || say "Some sources need attention; their state remains visible in the office."

mkdir -p "$APP/private" "$APP/logs" "$(dirname "$PLIST")" || fail "Cannot create office directories."
chmod 700 "$APP/private" || fail "Cannot protect the private directory."
BK=$(mktemp -d "$APP/private/release-before-__VERSION__-XXXXXXXX") || fail "Cannot create a rollback copy."
for item in bridge.py office.html MANIFEST.sha256 vendor; do
  if [ -e "$APP/$item" ]; then cp -pR "$APP/$item" "$BK/$item" || fail "Cannot save $item for rollback."; fi
done
if [ -f "$PLIST" ]; then cp -p "$PLIST" "$BK/launch-agent.plist" || fail "Cannot save the prior launch agent."; fi
if [ -f "$APP/private/state.json" ]; then cp -p "$APP/private/state.json" "$BK/state.json" || fail "Cannot save the prior boot state."; fi
curl -fsS --max-time 2 "${URL}health" > "$BK/previous-health.json" 2>/dev/null || rm -f "$BK/previous-health.json"
"$PY" -I -S -B - "$BK" <<'PY'
import hashlib,json,pathlib,sys
p=pathlib.Path(sys.argv[1]);values={}
for name in ('bridge.py','office.html','MANIFEST.sha256','vendor'):
    item=p/name
    if item.is_file():values[name]=hashlib.sha256(item.read_bytes()).hexdigest()
    elif item.is_dir():
        for f in item.rglob('*'):
            if f.is_file():values[str(f.relative_to(p))]=hashlib.sha256(f.read_bytes()).hexdigest()
for file,key in (('launch-agent.plist','@launch-agent'),('state.json','@state')):
    if (p/file).exists():values[key]=hashlib.sha256((p/file).read_bytes()).hexdigest()
(p/'rollback-files.json').write_text(json.dumps(values,sort_keys=True))
PY
[ $? -eq 0 ] || fail "Cannot record rollback checksums."
MUTATED=1
if [ "$WAS_LOADED" -eq 1 ]; then stop_office || fail "Cannot stop the previous office."; fi
for item in bridge.py office.html MANIFEST.sha256; do
  install -m 644 "$WORK/$item" "$APP/.$item.installing" && mv -f "$APP/.$item.installing" "$APP/$item" || fail "Cannot install $item."
done
rm -rf "$APP/vendor" && cp -R "$WORK/vendor" "$APP/vendor" || fail "Cannot install offline assets."
install -m 644 "$WORK/launch-agent.plist" "$PLIST" || fail "Cannot install the office launch agent."
(cd "$APP" && shasum -a 256 -c MANIFEST.sha256 >/dev/null) || fail "Installed payload checksum failed."
BOOT=$(sysctl -n kern.boottime 2>/dev/null | sed -E 's/.*sec = ([0-9]+).*/\1/')
if [ -n "$BOOT" ]; then printf '{"opened_boot":"%s"}\n' "$BOOT" > "$APP/private/state.json"; chmod 600 "$APP/private/state.json"; fi
start_office || fail "Cannot start the candidate office."
VALID=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 "${URL}health" > "$WORK/health.json" 2>/dev/null && verify_health "$WORK/health.json" "__VERSION__" "__BUILD_ID__" "__PAGE_VERSION__"; then VALID=1; break; fi
  sleep 1
done
[ "$VALID" -eq 1 ] || fail "The candidate did not return its exact version and build."
FLEET_LIST_AFTER=$(launchctl list 2>/dev/null) || fail "Cannot verify the fleet census."
FLEET_LABELS_AFTER=$(printf '%s\n' "$FLEET_LIST_AFTER" | awk '$3 ~ /^com\.beyderco\./ {print $3}' | sort)
[ "$FLEET_LABELS_AFTER" = "$FLEET_LABELS_BEFORE" ] || fail "The fleet census differs; candidate office will be rolled back."
COMMITTED=1
ok "Verified bridge __VERSION__, page __PAGE_VERSION__, unchanged fleet labels and preserved ledger"
open -a Safari "$URL" 2>/dev/null || open "$URL" || true
say "Office: $URL"
say "Previous release: $BK"
say "To remove while preserving files: bash \"$SELF\" --uninstall"
exit 0
__PAYLOAD_BELOW__
