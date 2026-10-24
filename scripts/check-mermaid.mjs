// Validates every ```mermaid block in docs/*.md.
// Primary: render each block with mmdc (mermaid-cli).
// Fallback (only when mmdc fails): syntax check with mermaid.parse.
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = resolve(import.meta.dirname, '..');
const docsDir = join(root, 'docs');
const outDir = join(root, '.tmp', 'mermaid');

const blockRe = /^```mermaid[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm;

async function collectBlocks() {
  const files = (await readdir(docsDir)).filter((f) => f.endsWith('.md'));
  const blocks = [];
  for (const file of files) {
    const text = await readFile(join(docsDir, file), 'utf8');
    for (const m of text.matchAll(blockRe)) {
      blocks.push({ source: `docs/${file}`, code: m[1] });
    }
  }
  return blocks;
}

async function renderWithMmdc(file) {
  // shell: true is required for npx on Windows; it joins args without escaping,
  // so paths (which may contain spaces) are quoted explicitly.
  await run('npx', ['mmdc', '-i', `"${file}"`, '-o', `"${file}.svg"`], {
    cwd: root,
    shell: true,
    windowsHide: true,
    timeout: 120_000,
  });
}

async function parseWithMermaid(code) {
  if (!globalThis.window) {
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('');
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
  }
  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({ startOnLoad: false });
  await mermaid.parse(code);
}

async function main() {
  const blocks = await collectBlocks();
  if (blocks.length === 0) {
    console.log('No mermaid blocks found in docs/*.md');
    return;
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  let failures = 0;
  for (let i = 0; i < blocks.length; i++) {
    const { source, code } = blocks[i];
    const file = join(outDir, `${i + 1}.mmd`);
    await writeFile(file, code, 'utf8');
    try {
      await renderWithMmdc(file);
      console.log(`OK   [mmdc] ${source} block ${i + 1}`);
    } catch (err) {
      try {
        await parseWithMermaid(code);
        console.log(`OK   [fallback parse] ${source} block ${i + 1} (mmdc failed: ${err.message.split('\n')[0]})`);
      } catch (parseErr) {
        failures++;
        console.error(`FAIL ${source} block ${i + 1}: ${parseErr.message}`);
      }
    }
  }

  if (failures > 0) {
    console.error(`${failures} mermaid block(s) failed`);
    process.exit(1);
  }
  console.log(`All ${blocks.length} mermaid block(s) passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
