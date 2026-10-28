import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The tests need an admin, which can only be made in the database
const root = fileURLToPath(new URL('../..', import.meta.url))
const password = readFileSync(`${root}.env`, 'utf8').match(/^MONGO_PASSWORD\s*=\s*(.*)$/m)[1].trim()

export const mongo = (script) =>
  execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'mongo', 'mongosh', '-u', 'maat', '-p', password, '--authenticationDatabase', 'admin', 'maat', '--quiet', '--eval', script],
    { cwd: root },
  ).toString()
