try:
    with open("/x", "w") as f:
        f.write("hello")
    print("WROTE")
except OSError:
    print("BLOCKED")
