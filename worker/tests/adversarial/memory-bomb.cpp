#include <cstdlib>
#include <cstring>

static char* volatile sink;

int main() {
    for (;;) {
        char* p = (char*)malloc(1 << 20);
        if (!p) return 1;
        memset(p, 1, 1 << 20);
        sink = p;
    }
}
