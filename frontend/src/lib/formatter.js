// clang-format and Ruff compiled to WebAssembly. Each is fetched the first time it is needed
const loaders = {
  cpp17: () => import('@wasm-fmt/clang-format/vite'),
  python3: () => import('@wasm-fmt/ruff_fmt/vite'),
}
const ready = {}

// Lines are wrapped to fit the editor, within reason: a phone gets 40 columns, a wide screen 120
const MIN_WIDTH = 40
const MAX_WIDTH = 120
const DEFAULT_WIDTH = 100

export async function formatCode(language, code, width = DEFAULT_WIDTH) {
  ready[language] ??= loaders[language]().then(async (formatter) => {
    await formatter.default()
    return formatter
  })
  const formatter = await ready[language]
  const limit = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.floor(width) || DEFAULT_WIDTH))
  return language === 'cpp17'
    ? formatter.format(code, 'main.cpp', `{BasedOnStyle: LLVM, IndentWidth: 4, ColumnLimit: ${limit}}`)
    : formatter.format(code, null, { indent_width: 4, line_width: limit })
}
