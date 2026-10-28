import { expect, test } from '@playwright/test'
import { mongo } from './db.js'

const run = Date.now().toString(36)
const email = `e2e-${run}@test.local`
const password = 'password123'
const slug = `e2e-sum-${run}`
const sum = 'print(sum(map(int, input().split())))'

let problemId
let contestId

test.describe.configure({ mode: 'serial' })

// Replaces the editor's content. insertText skips Monaco's auto-closing brackets
const writeCode = async (page, language, code) => {
  await page.selectOption('.editor-bar select', language)
  await page.click('.monaco-editor .view-lines')
  await page.keyboard.press('Control+A')
  await page.keyboard.insertText(code)
}

const submit = async (page, verdict) => {
  await page.click('button:has-text("Submit solution")')
  await expect(page.locator('.result-status')).toHaveText(verdict, { timeout: 40_000 })
}

const logIn = async (page) => {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button:has-text("Log in")')
  await expect(page.locator('.nav-account')).toContainText(`E2E ${run}`)
}

test.afterAll(() => {
  mongo(`
    const p = db.problems.findOne({ slug: '${slug}' });
    if (p) { db.submissions.deleteMany({ problemId: p._id }); db.testcases.deleteMany({ problemId: p._id }); db.problems.deleteOne({ _id: p._id }); }
    db.contests.deleteMany({ title: 'E2E contest ${run}' });
    db.users.deleteMany({ email: '${email}' });
  `)
})

test('public pages load with their own titles', async ({ page }) => {
  for (const [path, heading, title] of [
    ['/', 'Your code', 'Online judge'],
    ['/problems', 'Problems', 'Problems'],
    ['/contests', 'Contests', 'Contests'],
    ['/privacy', 'Privacy policy', 'Privacy policy'],
    ['/terms', 'Terms of use', 'Terms of use'],
  ]) {
    await page.goto(path)
    await expect(page.locator('h1').first()).toContainText(heading)
    await expect(page).toHaveTitle(new RegExp(title))
  }
  await expect(page.locator('meta[name="description"]')).toHaveCount(1)
})

test('private pages send you to log in first', async ({ page }) => {
  await page.goto('/submissions')
  await expect(page).toHaveURL(/\/login\?next=%2Fsubmissions/)
})

test('sign up, then set up a problem and a contest as an admin', async ({ page }) => {
  await page.goto('/signup')
  await page.fill('#name', `E2E ${run}`)
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.fill('#confirm', password)
  await page.click('button:has-text("Create account")')
  await expect(page.locator('.nav-account')).toContainText(`E2E ${run}`)

  mongo(`db.users.updateOne({ email: '${email}' }, { $set: { role: 'admin' } })`)
  await page.reload()

  const problem = await page.request.post('/api/v1/admin/problems', {
    data: { title: `Sum ${run}`, slug, statementMd: 'Print **a + b**.', timeLimitMs: 2000, memoryLimitMb: 128, visible: true },
  })
  problemId = (await problem.json()).data.problem._id
  await page.request.post(`/api/v1/admin/problems/${problemId}/testcases/bulk`, {
    data: {
      testCases: [
        { input: '1 2\n', expectedOutput: '3\n', isSample: true },
        { input: '100 200\n', expectedOutput: '300\n' },
      ],
    },
  })
  const contest = await page.request.post('/api/v1/contests', {
    data: {
      title: `E2E contest ${run}`,
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 3_600_000).toISOString(),
      problems: [{ problemId, label: 'A' }],
    },
  })
  contestId = (await contest.json()).data.contest._id

  await page.goto(`/admin/problems/${problemId}`)
  await page.click('button:has-text("Add test case")')
  await page.fill('#tc-input', '2 2\n')
  await page.fill('#tc-output', '4\n')
  await page.click('button:has-text("Save test case")')
  await expect(page.locator('.testcase-list li')).toHaveCount(3)
})

test('a problem shows only its examples', async ({ page }) => {
  await page.goto(`/problems/${slug}`)
  await expect(page.locator('.prose strong')).toHaveText('a + b')
  await expect(page.locator('.sample')).toHaveCount(1)
  await expect(page.locator('body')).not.toContainText('100 200')
})

test('verdicts arrive live in the editor', async ({ page }) => {
  await logIn(page)
  await page.goto(`/problems/${slug}`)
  await page.waitForSelector('.monaco-editor', { timeout: 30_000 })

  await writeCode(page, 'python3', sum)
  await submit(page, 'Accepted')
  await expect(page.locator('.tests li')).toHaveCount(3)

  await writeCode(page, 'python3', 'print(0)')
  await submit(page, 'Wrong answer')

  await writeCode(page, 'cpp17', 'int main( {')
  await submit(page, 'Compile error')
  await expect(page.locator('.compile-output')).toContainText('error')

  await page.goto('/submissions')
  await expect(page.locator('table tbody tr')).toHaveCount(3)

  await page.goto(`/problems?search=${encodeURIComponent(`Sum ${run}`)}`)
  await expect(page.locator('table tbody tr').first()).toContainText('Solved')
})

test('a contest submission appears on the standings', async ({ page }) => {
  await logIn(page)

  await page.goto(`/problems/${slug}?contest=${contestId}`)
  await expect(page.locator('.notice').first()).toContainText(`E2E contest ${run}`)
  await page.waitForSelector('.monaco-editor', { timeout: 30_000 })
  await writeCode(page, 'python3', sum)
  await submit(page, 'Accepted')

  await page.goto(`/contests/${contestId}`)
  await expect(page.locator('.standings tbody')).toContainText(`E2E ${run}`)
  await expect(page.locator('table').first()).toContainText('Solved')
})

test('deleting the account logs you out, and logging in again keeps it', async ({ page }) => {
  await logIn(page)

  await page.goto('/profile')
  await page.fill('#delete-password', password)
  await page.click('button:has-text("Delete my account")')
  await page.click('dialog button:has-text("Delete my account")')
  await expect(page.locator('.nav-account')).toContainText('Log in')

  await logIn(page)
  await expect(page.locator('.nav-account')).toContainText(`E2E ${run}`)
})
