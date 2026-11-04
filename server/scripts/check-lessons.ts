// Runs every lesson's Python example and compares its printed output with the published output.
// Usage: tsx server/scripts/check-lessons.ts <path-to-python-with-numpy-sklearn-torch>
import { spawnSync } from 'node:child_process'
import { lessons } from '../../src/content/lessons'

const python = process.argv[2] ?? 'python3'
let failures = 0
for (const lesson of lessons) {
  const run = spawnSync(python, ['-W', 'ignore', '-c', lesson.code], { encoding: 'utf8', timeout: 180_000 })
  const printed = run.stdout.trim()
  if (run.status !== 0) {
    failures += 1
    console.log(`FAIL  ${lesson.slug}: exit ${run.status}\n${run.stderr.trim().split('\n').slice(-4).join('\n')}`)
  } else if (lesson.codeOutput === undefined) {
    console.log(`ran   ${lesson.slug} (no published output)\n${printed.replace(/^/gm, '        ')}`)
  } else if (printed !== lesson.codeOutput.trim()) {
    failures += 1
    console.log(`DIFF  ${lesson.slug}\n  published:\n${lesson.codeOutput.replace(/^/gm, '    ')}\n  actual:\n${printed.replace(/^/gm, '    ')}`)
  } else {
    console.log(`ok    ${lesson.slug}`)
  }
}
console.log(failures ? `\n${failures} lesson(s) need attention.` : `\nAll ${lessons.length} lesson examples check out.`)
process.exit(failures ? 1 : 0)
