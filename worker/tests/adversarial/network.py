import socket

try:
    socket.create_connection(("1.1.1.1", 80), timeout=2)
    print("CONNECTED")
except OSError:
    print("BLOCKED")
