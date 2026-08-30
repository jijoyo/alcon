import socket, threading

LISTEN_HOST = "100.121.64.26"
LISTEN_PORT = 20128
TARGET_HOST = "127.0.0.1"
TARGET_PORT = 20128

def handle(client):
    try:
        remote = socket.create_connection((TARGET_HOST, TARGET_PORT))
        def forward(a,b):
            try:
                while True:
                    d=a.recv(4096)
                    if not d: break
                    b.sendall(d)
            except: pass
            try: a.close()
            except: pass
            try: b.close()
            except: pass
        threading.Thread(target=forward, args=(client, remote), daemon=True).start()
        threading.Thread(target=forward, args=(remote, client), daemon=True).start()
    except Exception as e:
        try: client.close()
        except: pass

s=socket.socket()
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind((LISTEN_HOST, LISTEN_PORT))
s.listen(100)
print(f"Forwarder {LISTEN_HOST}:{LISTEN_PORT} -> {TARGET_HOST}:{TARGET_PORT}")
while True:
    c,_=s.accept()
    threading.Thread(target=handle, args=(c,), daemon=True).start()
