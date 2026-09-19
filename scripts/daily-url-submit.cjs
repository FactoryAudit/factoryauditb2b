#!/usr/bin/env node
'use strict';
/*
 * daily-url-submit.cjs — monitorable daily fallback for URL submission.
 *
 * Runs the same diff→submit pipeline as post-publish-submit.cjs, but appends a
 * timestamped, parseable record to .url-submit-log.txt so a scheduler can alert
 * on failures. Intended to be triggered by:
 *   - Windows Task Scheduler (schtasks) once/day
 *   - Linux/macOS cron (0 6 * * * node /path/daily-url-submit.cjs)
 *
 * Exit code: 0 on success, 1 if the child pipeline errored.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOG = path.join(ROOT, '.url-submit-log.txt');

function ts() {
  const d = new Date();
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function main() {
  const header = `\n===== ${ts()} daily-url-submit START =====`;
  const parts = [header];
  let exitCode = 0;
  try {
    const out = execFileSync(process.execPath, [path.join(__dirname, 'post-publish-submit.cjs')], {
      encoding: 'utf8',
      env: process.env,
    });
    parts.push(out);
  } catch (e) {
    exitCode = 1;
    parts.push('CHILD_ERROR: ' + (e.stderr || e.message || e).toString().slice(0, 800));
  }
  const summary = `===== ${ts()} daily-url-submit END (exit=${exitCode}) =====`;
  parts.push(summary);
  fs.appendFileSync(LOG, parts.join('\n') + '\n');
  console.log(parts.join('\n'));
  process.exit(exitCode);
}
main();
