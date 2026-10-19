// Verifies that relative (internal) markdown link targets exist.
// External links (http://, https://, mailto:) and pure anchors (#...) are skipped.
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const linkRe = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

async function listMarkdown() {
  const files = ['README.md'];
  for (const f of await readdir(join(root, 'docs'))) {
    if (f.endsWith('.md')) files.push(join('docs', f));
  }
  return files;
}

function isExternal(target) {
  return /^(https?:|mailto:|tel:)/i.test(target) || target.startsWith('#');
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const files = await listMarkdown();
  let checked = 0;
  const broken = [];

  for (const rel of files) {
    const text = await readFile(join(root, rel), 'utf8');
    for (const m of text.matchAll(linkRe)) {
      const raw = m[1];
      if (isExternal(raw)) continue;
      const target = raw.split('#')[0];
      if (target === '') continue;
      checked++;
      const abs = resolve(dirname(join(root, rel)), decodeURI(target));
      if (!(await exists(abs))) broken.push(`${rel} -> ${raw}`);
    }
  }

  if (broken.length > 0) {
    console.error('Broken internal links:');
    for (const b of broken) console.error(`  ${b}`);
    process.exit(1);
  }
  console.log(`Checked ${checked} internal link(s), none broken`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
