import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

function getAllMarkdownFiles(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);
  for (const file of files) {
    if (file === "node_modules" || file === ".next" || file === ".git") continue;
    const filePath = join(dir, file);
    if (statSync(filePath).isDirectory()) {
      getAllMarkdownFiles(filePath, fileList);
    } else if (file.endsWith(".md")) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

let hasError = false;
const mdFiles = getAllMarkdownFiles(".");

for (const file of mdFiles) {
  const content = readFileSync(file, "utf-8");
  const mermaidRegex = /```mermaid([\s\S]*?)```/g;
  let match;
  let count = 0;

  while ((match = mermaidRegex.exec(content)) !== null) {
    count++;
    const code = match[1].trim();
    // Validasi sintaks dasar diagram mermaid
    const validOpeners = ["graph", "flowchart", "sequenceDiagram", "classDiagram", "stateDiagram", "erDiagram", "gantt", "pie"];
    const firstWord = code.split(/\s+/)[0];

    if (!validOpeners.some((opener) => code.startsWith(opener))) {
      console.error(`❌ [${file}] Blok mermaid #${count} memiliki deklarasi pembuka yang tidak valid: "${firstWord}"`);
      hasError = true;
    }
  }

  if (count > 0) {
    console.log(`✓ [${file}] ${count} blok diagram Mermaid terverifikasi.`);
  }
}

if (hasError) {
  console.error("\n❌ Verifikasi blok Mermaid gagal.");
  process.exit(1);
} else {
  console.log("\n✅ Semua blok diagram Mermaid lolos validasi.");
}
