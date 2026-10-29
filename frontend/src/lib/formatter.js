// clang-format and Ruff compiled to WebAssembly. Each is fetched the first time it is needed
const STYLE = '{BasedOnStyle: LLVM, IndentWidth: 4, ColumnLimit: 100}'

const loaders = {
  cpp17: () => import('@wasm-fmt/clang-format/vite'),
  python3: () => import('@wasm-fmt/ruff_fmt/vite'),
}
const ready = {}

export async function formatCode(language, code) {
  ready[language] ??= loaders[language]().then(async (formatter) => {
    await formatter.default()
    return formatter
  })
  const formatter = await ready[language]
  return language === 'cpp17' ? formatter.format(code, 'main.cpp', STYLE) : formatter.format(code)
}
