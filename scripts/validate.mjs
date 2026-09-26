#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const requiredMetadataDirectories = new Set(['daily', 'weekly', 'reviews', 'sources', 'wiki']);
const validStatuses = new Set(['draft', 'review', 'published', 'archived']);
const errors = [];

const isMarkdown = (path) => path.endsWith('.md');
const isInsideRoot = (path) => !relative(root, path).startsWith(`..${sep}`) && relative(root, path) !== '..';

function listFiles(directory) {
  const absoluteDirectory = resolve(root, directory);
  if (!existsSync(absoluteDirectory)) return [];
  const files = [];
  for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const absolutePath = resolve(absoluteDirectory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(relative(root, absolutePath)));
    if (entry.isFile() && isMarkdown(absolutePath)) files.push(absolutePath);
  }
  return files;
}

function parseFrontmatter(content, relativePath) {
  if (!content.startsWith('---\n')) {
    errors.push(`${relativePath}: missing YAML frontmatter`);
    return null;
  }
  const end = content.indexOf('\n---', 4);
  if (end === -1) {
    errors.push(`${relativePath}: unterminated YAML frontmatter`);
    return null;
  }
  const values = new Map();
  for (const line of content.slice(4, end).split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#') || line.startsWith(' ')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (match) values.set(match[1], match[2].trim());
  }
  return values;
}

function validateMetadata(path, content) {
  const relativePath = relative(root, path);
  const firstDirectory = relativePath.split(sep)[0];
  if (!requiredMetadataDirectories.has(firstDirectory)) return;

  const metadata = parseFrontmatter(content, relativePath);
  if (!metadata) return;
  for (const key of ['title', 'created', 'updated', 'status', 'owners', 'sources']) {
    if (!metadata.has(key) || !metadata.get(key)) errors.push(`${relativePath}: missing required frontmatter field '${key}'`);
  }
  if (metadata.has('status') && !validStatuses.has(metadata.get('status'))) {
    errors.push(`${relativePath}: unsupported status '${metadata.get('status')}'`);
  }
  if (relativePath.startsWith(`sources${sep}`)) {
    for (const key of ['source_kind', 'redaction', 'reviewed_by']) {
      if (!metadata.has(key) || !metadata.get(key)) errors.push(`${relativePath}: missing required source archive field '${key}'`);
    }
  }
  for (const key of ['created', 'updated']) {
    const value = metadata.get(key);
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) errors.push(`${relativePath}: '${key}' must use YYYY-MM-DD`);
  }
}

function validateLinks(path, content) {
  const relativePath = relative(root, path);
  const linkPattern = /(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g;
  for (const match of content.matchAll(linkPattern)) {
    const rawTarget = match[1].replace(/^<|>$/g, '');
    if (!rawTarget || rawTarget.startsWith('#') || /^(https?:|mailto:|tel:|data:)/i.test(rawTarget)) continue;
    const target = rawTarget.split('#', 1)[0];
    if (!target) continue;
    const resolvedTarget = resolve(path, '..', target);
    if (!isInsideRoot(resolvedTarget) || !existsSync(resolvedTarget)) {
      errors.push(`${relativePath}: unresolved local link '${rawTarget}'`);
    }
  }
}

function validateSensitiveContent(path, content) {
  const relativePath = relative(root, path);
  const rules = [
    ['AWS access key', /\b(AKIA|ASIA)[A-Z0-9]{16}\b/],
    ['GitHub token', /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
    ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ['generic secret assignment', /(?:(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?)(?!\{\{)[A-Za-z0-9_\-\/+=]{16,}/i],
  ];
  for (const [label, pattern] of rules) {
    if (pattern.test(content)) errors.push(`${relativePath}: possible ${label}; remove it and use a redacted reference instead`);
  }
}

const files = ['README.md', ...listFiles('docs'), ...listFiles('daily'), ...listFiles('weekly'), ...listFiles('reviews'), ...listFiles('sources'), ...listFiles('wiki')]
  .map((file) => resolve(root, file))
  .filter((file, index, all) => existsSync(file) && statSync(file).isFile() && all.indexOf(file) === index);

for (const path of files) {
  const content = readFileSync(path, 'utf8');
  validateMetadata(path, content);
  validateLinks(path, content);
  validateSensitiveContent(path, content);
}

if (errors.length > 0) {
  console.error(`Validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Validation passed for ${files.length} Markdown file(s).`);
}
