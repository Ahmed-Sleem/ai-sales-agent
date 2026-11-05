#!/usr/bin/env node
/** Scans product source for credential-shaped strings before verification or publication. */
import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set(['.git', 'node_modules', '.next', 'out', 'dist', 'build', 'coverage', 'playwright-report', 'test-results', '_working_docs']);
const SKIP_EXT = new Set(['.glb', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.mp4', '.webm', '.pdf', '.zip']);
const PATTERNS = [
  { name: 'github-pat', re: /ghp_[A-Za-z0-9]{36}/g },
  { name: 'github-fine-grained-pat', re: /github_pat_[A-Za-z0-9_]{22,}/g },
  { name: 'openai-style-key', re: /sk-[A-Za-z0-9]{20,}/g },
  { name: 'aws-access-key', re: /AKIA[0-9A-Z]{16}/g },
  { name: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'assigned-secret', re: /(?:api[_-]?key|apikey|secret|password|access_token)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/gi },
];

export function findSecrets(content, filePath = '') {
  const hits = [];
  for (const { name, re } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      hits.push({ file: filePath, type: name, index: m.index });
    }
  }
  return hits;
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.env') && entry.name !== '.env.example') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(full);
    } else if (!SKIP_EXT.has(path.extname(entry.name).toLowerCase())) {
      yield full;
    }
  }
}

export function scanTree(root) {
  const hits = [];
  for (const file of walk(root)) {
    const content = fs.readFileSync(file, 'utf8');
    hits.push(...findSecrets(content, path.relative(root, file)));
  }
  return hits;
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const root = process.cwd();
  const hits = scanTree(root);
  if (hits.length) {
    console.error(`Secret scan failed: ${hits.length} potential credential(s).`);
    for (const h of hits.slice(0, 20)) console.error(`- ${h.file}: ${h.type}`);
    process.exit(1);
  }
  console.log('Secret scan clean.');
}
