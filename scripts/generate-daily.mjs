#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function usage() {
  console.log(`Usage: node scripts/generate-daily.mjs [options]

Default mode is dry-run: it prints the planned branch and document path without changing Git.

Options:
  --date YYYY-MM-DD   Daily date (default: local today)
  --owner NAME        Frontmatter owner (default: local Git user.name)
  --body-file PATH    Markdown body supplied by a reviewed OpenClaw skill output
  --execute           Create a local agent branch, write the document, validate, and commit
  --push              Push the generated branch; requires --execute
  --create-pr         Create a draft GitHub PR; requires --execute --push and gh authentication
  --help              Show this help
`);
}

function run(command, args, options = {}) {
  const output = execFileSync(command, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
  return String(output || '').trim();
}

function parseArgs(args) {
  const parsed = { execute: false, push: false, createPr: false, date: null, owner: null, bodyFile: null };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--help') return { help: true };
    if (value === '--execute') parsed.execute = true;
    else if (value === '--push') parsed.push = true;
    else if (value === '--create-pr') parsed.createPr = true;
    else if (['--date', '--owner', '--body-file'].includes(value)) {
      const optionValue = args[index + 1];
      if (!optionValue || optionValue.startsWith('--')) throw new Error(`${value} requires a value`);
      parsed[value.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = optionValue;
      index += 1;
    } else throw new Error(`unknown option: ${value}`);
  }
  if (parsed.push && !parsed.execute) throw new Error('--push requires --execute');
  if (parsed.createPr && (!parsed.execute || !parsed.push)) throw new Error('--create-pr requires --execute --push');
  return parsed;
}

function localToday() {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function assertDate(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`--date must use a real YYYY-MM-DD date, received '${value}'`);
  }
  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== Number(month) - 1 || parsed.getUTCDate() !== Number(day)) {
    throw new Error(`--date must use a real YYYY-MM-DD date, received '${value}'`);
  }
}

function renderTemplate(template, replacements) {
  return template.replace(/\{\{(date|owner)\}\}/g, (_, key) => replacements[key]);
}

function ensureCleanMain() {
  if (run('git', ['branch', '--show-current']) !== 'main') throw new Error('generation must start from local main');
  if (run('git', ['status', '--porcelain'])) throw new Error('worktree must be clean before --execute');
}

function appendBody(document, body) {
  if (!body.trim()) return document;
  return `${document.trimEnd()}\n\n${body.trim()}\n`;
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    process.exit(0);
  }

  const date = options.date || localToday();
  assertDate(date);
  const owner = options.owner || run('git', ['config', 'user.name']) || 'unassigned';
  const [year, month] = date.split('-');
  const relativePath = `daily/${year}/${month}/${date}.md`;
  const outputPath = resolve(root, relativePath);
  const branch = `agent/${date}-daily`;
  const body = options.bodyFile ? readFileSync(resolve(process.cwd(), options.bodyFile), 'utf8') : '';

  console.log(`Mode: ${options.execute ? 'execute' : 'dry-run'}`);
  console.log(`Branch: ${branch}`);
  console.log(`Document: ${relativePath}`);
  console.log(`Body: ${options.bodyFile ? basename(options.bodyFile) : 'template sections only'}`);

  if (!options.execute) {
    console.log('No files or Git state were changed. Re-run with --execute after reviewing the inputs.');
    process.exit(0);
  }

  ensureCleanMain();
  if (existsSync(outputPath)) throw new Error(`${relativePath} already exists; edit it manually or choose a different date`);

  const template = readFileSync(resolve(root, 'templates/daily.md'), 'utf8');
  mkdirSync(resolve(root, `daily/${year}/${month}`), { recursive: true });
  run('git', ['switch', '-c', branch]);
  writeFileSync(outputPath, appendBody(renderTemplate(template, { date, owner }), body), 'utf8');
  run('node', ['scripts/validate.mjs'], { stdio: 'inherit' });
  run('git', ['add', relativePath]);
  run('git', ['commit', '-m', `docs: add daily ${date}`], { stdio: 'inherit' });

  if (options.push) run('git', ['push', '--set-upstream', 'origin', branch], { stdio: 'inherit' });
  if (options.createPr) {
    run('gh', ['pr', 'create', '--draft', '--base', 'main', '--head', branch, '--title', `docs: add daily ${date}`, '--fill'], { stdio: 'inherit' });
  }
} catch (error) {
  console.error(`Daily generation failed: ${error.message}`);
  process.exitCode = 1;
}
