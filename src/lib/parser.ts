/**
 * Parses a Telegram-style index:
 * Lines with '= Módulo ...' start a new module.
 * Tags like #D001 #D002 are collected as episodes.
 */
export type ParsedModule = { title: string; tags: string[] };
export type ParsedIndex = { modules: ParsedModule[] };

// Tags do tipo #D001, #a10, #TAG_01, etc. (ASCII)
export const TAG_REGEX = /#[A-Za-z][A-Za-z0-9_-]*\d*/g;
const HEADING_PREFIX = /^=+\s*/; // linhas que começam com um ou mais '='
// Cabeçalhos numéricos e "Módulo X -" (sem tags na mesma linha)
const NUM_HEADING =
  /^(?:\s*(?:\d+|[IVXLCDM]+)\s*[).:-]|\s*m[óo]dulo\s*\d+\s*[-:)]?)/i;

function isHeading(line: string): boolean {
  if (HEADING_PREFIX.test(line)) return true;
  // Evita tratar como heading se a linha contém tags
  if (TAG_REGEX.test(line)) return false;
  return NUM_HEADING.test(line);
}

function stripHeadingSyntax(line: string): string {
  if (HEADING_PREFIX.test(line)) return line.replace(HEADING_PREFIX, "").trim();
  if (NUM_HEADING.test(line)) return line.replace(NUM_HEADING, "").trim();
  return line.trim();
}

export function parseIndex(input: string): ParsedIndex {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const modules: ParsedModule[] = [];
  let current: ParsedModule | null = null;

  for (const line of lines) {
    if (isHeading(line)) {
      if (current) modules.push(current);
      current = { title: stripHeadingSyntax(line), tags: [] };
      continue;
    }
    const tags = line.match(TAG_REGEX) || [];
    if (tags.length) {
      if (!current) current = { title: "Sem Título", tags: [] };
      current.tags.push(...tags);
    }
  }
  if (current) modules.push(current);
  return { modules };
}
