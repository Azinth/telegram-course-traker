/**
 * Parses a Telegram-style index:
 * Lines with '= Módulo ...' start a new module.
 * Tags like #D001 #D002 are collected as episodes.
 */
export type ParsedModule = { title: string; tags: string[] };
export type ParsedIndex = { modules: ParsedModule[] };

const TAG_REGEX = /#[A-Za-z]+\d+/g;
const HEADING_PREFIX = /^=+\s*/; // linhas que começam com um ou mais '='

export function parseIndex(input: string): ParsedIndex {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const modules: ParsedModule[] = [];
  let current: ParsedModule | null = null;

  for (const line of lines) {
    if (HEADING_PREFIX.test(line)) {
      if (current) modules.push(current);
      current = { title: line.replace(HEADING_PREFIX, ""), tags: [] };
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
