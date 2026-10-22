constexpr long long f(int n) { return n < 2 ? n : f(n - 1) + f(n - 2); }
static_assert(f(60) > 0, "never finishes in time");

int main() {}
