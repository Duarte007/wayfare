/**
 * Writes the failed tests and their errors (call logs included) as Markdown, for the CI job
 * summary: readable on the run page without downloading the report.
 * Usage: node --experimental-strip-types support/ci-summary.ts results.json >> "$GITHUB_STEP_SUMMARY"
 */
import { readFileSync } from 'node:fs';

interface Result {
  status: string;
  retry: number;
  errors: { message?: string }[];
}
interface Suite {
  title: string;
  specs?: { title: string; tests: { projectName: string; results: Result[] }[] }[];
  suites?: Suite[];
}

const report = JSON.parse(readFileSync(process.argv[2] ?? 'results.json', 'utf8')) as {
  suites: Suite[];
};
// Strip ANSI colours and the browser's own stderr, which says nothing about the app.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const clean = (s: string) =>
  s.replace(ANSI, '').replace(/Browser logs:[\s\S]*?(?=Call log:|$)/, '');

const lines: string[] = ['## End-to-end failures', ''];
const walk = (suite: Suite, path: string[]) => {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests) {
      for (const result of test.results) {
        if (result.status === 'passed' || result.status === 'skipped') continue;
        lines.push(
          `### [${test.projectName}] ${[...path, spec.title].join(' › ')} (try ${result.retry + 1}: ${result.status})`,
        );
        for (const error of result.errors)
          lines.push('```', clean(error.message ?? '').slice(0, 4000), '```');
      }
    }
  }
  for (const child of suite.suites ?? []) walk(child, [...path, child.title]);
};
for (const suite of report.suites) walk(suite, [suite.title]);
console.log(lines.length > 2 ? lines.join('\n') : 'No failed tests in the report.');
