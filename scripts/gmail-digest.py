#!/usr/bin/env python3
# gmail-digest.py — digest de no-leídos de Gmail vía IMAP (solo stdlib).
# Credenciales (NUNCA en repo/chat):
#   1. Crea contraseña de aplicación: myaccount.google.com/apppasswords
#   2. Guárdala en keyring (tu terminal):
#        secret-tool store --label=gmail-digest service gmail-digest user TU_CORREO
#      (te pide la app-password una vez; de ahí la lee el script)
# Uso: gmail-digest.py --user TU_CORREO [--limit N] [--since YYYY-MM-DD] [--all]
import argparse
import email
import imaplib
import os
import socket
import subprocess
import sys
from email.header import decode_header

HOST = "imap.gmail.com"


# IPv6 roto en forja (timeouts): forzar IPv4 primero, con timeout corto.
# Se conserva el hostname → la verificación del certificado SSL sigue intacta.
_orig_getaddrinfo = socket.getaddrinfo


def _v4first(*a, **k):
    res = _orig_getaddrinfo(*a, **k)
    res.sort(key=lambda r: r[0] != socket.AF_INET)
    return res


socket.getaddrinfo = _v4first


def cred(user):
    pw = os.environ.get("GMAIL_APP_PASS")
    if pw:
        return pw.strip()
    pf = os.environ.get("GMAIL_PASS_FILE", os.path.expanduser("~/.config/agente/gmail-app-pass.txt"))
    if os.path.isfile(pf):
        with open(pf) as f:
            v = f.read().strip()
            if v:
                return v
    try:
        out = subprocess.run(
            ["secret-tool", "lookup", "service", "gmail-digest", "user", user],
            capture_output=True, text=True, timeout=10,
        )
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()
    except FileNotFoundError:
        pass
    return None


def dec(raw):
    if not raw:
        return "(sin asunto)"
    parts = []
    for chunk, enc in decode_header(raw):
        if isinstance(chunk, bytes):
            parts.append(chunk.decode(enc or "utf-8", "replace"))
        else:
            parts.append(chunk)
    return "".join(parts).strip() or "(sin asunto)"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--user", default=os.environ.get("GMAIL_USER", ""))
    ap.add_argument("--limit", type=int, default=20)
    ap.add_argument("--since", default="")
    ap.add_argument("--all", action="store_true", help="incluye leídos recientes")
    a = ap.parse_args()
    if not a.user:
        sys.exit("Falta --user o GMAIL_USER.")
    pw = cred(a.user)
    if not pw:
        sys.exit("Sin credencial: pon GMAIL_APP_PASS o guarda con secret-tool (ver header).")
    try:
        m = imaplib.IMAP4_SSL(HOST, timeout=15)
        m.login(a.user, pw)
    except imaplib.IMAP4.error as e:
        sys.exit(f"Auth falló: {e} (¿contraseña de aplicación? ¿2FA activo?)")
    m.select("INBOX", readonly=True)
    crit = f'(SINCE "{a.since}")' if a.since else ("ALL" if a.all else "UNSEEN")
    _, ids = m.search(None, crit)
    ids = ids[0].split()[-a.limit:]
    print(f"INBOX {a.user}: {len(ids)} mensajes ({crit})")
    for i in ids:
        _, data = m.fetch(i, "(RFC822.HEADER)")
        msg = email.message_from_bytes(data[0][1])
        print(f"- {msg.get('Date','?')[:31]} | {dec(msg.get('From'))[:60]} | {dec(msg.get('Subject'))[:100]}")
    m.logout()


if __name__ == "__main__":
    main()
