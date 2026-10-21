/**
 * Lists the failed tests and their errors (call logs included), so a CI failure can be read on
 * the run page without downloading the report.
 *
 *   node --experimental-strip-types support/ci-summary.ts results.json >> "$GITHUB_STEP_SUMMARY"
 *   node --experimental-strip-types support/ci-summary.ts results.json --annotate
 *
 * The first writes Markdown for the job summary; the second prints each error as an `::error`
 * workflow command, which shows as an annotation (also readable through the check-runs API).
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

const [file = 'results.json', ...flags] = process.argv.slice(2);
const annotate = flags.includes('--annotate');
const report = JSON.parse(readFileSync(file, 'utf8')) as { suites: Suite[] };

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const clean = (s: string) =>
  s
    .replace(ANSI, '')
    // The browser's own stderr says nothing about the app.
    .replace(/Browser logs:[\s\S]*?(?=Call log:|$)/, '')
    // Element dumps in call logs: the Tailwind classes hide the part that matters.
    .replace(/ class="[^"]*"/g, '')
    .slice(0, 4000);

const lines: string[] = ['## End-to-end failures', ''];
const walk = (suite: Suite, path: string[]) => {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests) {
      for (const result of test.results) {
        if (result.status === 'passed' || result.status === 'skipped') continue;
        const title = `[${test.projectName}] ${[...path, spec.title].join(' › ')} (try ${result.retry + 1}: ${result.status})`;
        lines.push(`### ${title}`);
        for (const error of result.errors) {
          const message = clean(error.message ?? '');
          lines.push('```', message, '```');
          if (annotate) {
            const escaped = message.replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
            console.log(`::error title=${title.replace(/[:,]/g, ' ')}::${escaped}`);
          }
        }
      }
    }
  }
  for (const child of suite.suites ?? []) walk(child, [...path, child.title]);
};
for (const suite of report.suites) walk(suite, [suite.title]);
if (!annotate) console.log(lines.length > 2 ? lines.join('\n') : 'No failed tests in the report.');
