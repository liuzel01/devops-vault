#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outputRoot = resolve(root, 'public');
const contentRoot = resolve(root, 'content');
const errors = [];

function listFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path));
    if (entry.isFile()) files.push(path);
  }
  return files;
}

if (!existsSync(outputRoot) || !statSync(outputRoot).isDirectory()) {
  errors.push('public/: build output does not exist');
}

const outputFiles = listFiles(outputRoot).map((path) => relative(outputRoot, path).split(sep).join('/'));
const forbiddenRoots = ['daily/', 'docs/', 'inbox/', 'scripts/', 'sources/', 'templates/'];
for (const file of outputFiles) {
  if (forbiddenRoots.some((prefix) => file.startsWith(prefix))) {
    errors.push(`public/${file}: forbidden directory was published`);
  }
}

for (const path of listFiles(contentRoot).filter((path) => path.endsWith('.md'))) {
  const content = readFileSync(path, 'utf8');
  if (!/^publish:\s*false\s*$/m.test(content)) continue;
  const markdownPath = relative(contentRoot, path).split(sep).join('/');
  const htmlPath = markdownPath.replace(/\.md$/, '.html');
  if (outputFiles.includes(htmlPath)) errors.push(`public/${htmlPath}: unpublished page was emitted`);
}

if (!outputFiles.includes('index.html')) errors.push('public/index.html: site index was not emitted');
if (!outputFiles.some((file) => file.startsWith('reviews/') && file.endsWith('.html'))) {
  errors.push('public/reviews/: no published Review pages were emitted');
}

if (errors.length > 0) {
  console.error(`Site output check failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Site output check passed for ${outputFiles.length} generated file(s).`);
}
