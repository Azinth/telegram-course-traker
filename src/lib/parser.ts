/**
 * Parser para índices de cursos no estilo Telegram.
 * "= Título" inicia um novo módulo (nível 1). "==", "===" etc criam seções.
 * Tags como #D001 #A02 são coletadas como episódios.
 */

export type ParsedModule = { title: string; tags: string[] };
export type ParsedIndex = { modules: ParsedModule[] };
export type ParsedSection = { title: string; tags: string[] };
export type ParsedModuleWithSections = {
  title: string;
  sections: ParsedSection[];
};
export type ParsedIndexHier = { modules: ParsedModuleWithSections[] };
export type ParseOptions = { promoteModuloHeadings?: boolean };

// Tags do tipo #D001, #a10, #TAG_01, etc. (ASCII)
export const TAG_REGEX = /#[A-Za-z][A-Za-z0-9_-]*\d*/g;

const EQ_HEADING = /^(=+)\s*/; // captura a sequência de '='
const NUM_HEADING = /^(?:\s*(?:\d+(?:\.\d+)?)|[IVXLCDM]+)\s*[).:-]?\s*/i; // 1., 1), I., etc
const MODULO_HEADING = /^\s*m[óo]dulo\s*\d+(?:\.\d+)?\s*[-:)]?/i; // Módulo 1 - ...

function getHeadingLevel(line: string, opts?: ParseOptions): number | null {
  if (TAG_REGEX.test(line)) return null; // linhas com apenas tags não são headings
  const m = line.match(EQ_HEADING);
  if (m) {
    const eqLevel = m[1].length;
    const title = line.replace(EQ_HEADING, "");
    const promote = opts?.promoteModuloHeadings ?? true;
    if (promote && MODULO_HEADING.test(title)) return 1;
    return eqLevel; // quantidade de '=' define o nível
  }
  const promote = opts?.promoteModuloHeadings ?? true;
  if (promote && MODULO_HEADING.test(line)) return 1; // sem '=' e é "Módulo X"
  if (NUM_HEADING.test(line)) return 2; // subnível genérico
  return null;
}

function stripHeadingTitle(line: string): string {
  const m = line.match(EQ_HEADING);
  if (m) return line.replace(EQ_HEADING, "").trim();
  // remove prefixos numéricos e "Módulo X -" no começo
  return line.replace(NUM_HEADING, "").replace(MODULO_HEADING, "").trim();
}

export function parseIndex(input: string): ParsedIndex {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const modules: ParsedModule[] = [];
  let current: ParsedModule | null = null;

  for (const line of lines) {
    const level = getHeadingLevel(line);
    if (level != null) {
      // Apenas headings de nível 1 ('=') criam novo módulo
      if (level === 1) {
        if (current) modules.push(current);
        current = { title: stripHeadingTitle(line) || "Sem Título", tags: [] };
      }
      // Níveis > 1 são submódulos e não criam módulos próprios; as tags seguintes irão para o módulo atual
      continue;
    }
    const tags = line.match(TAG_REGEX) || [];
    if (tags.length) {
      // Ignore tags antes do primeiro módulo para evitar criar "Sem Título"
      if (!current) continue;
      current.tags.push(...tags);
    }
  }
  if (current) modules.push(current);
  return { modules };
}

// Versão hierárquica: retorna módulos (nível '=') e seções (nível '==', '===', numéricos ou "Módulo X")
export function parseIndexHierarchical(
  input: string,
  opts?: ParseOptions,
): ParsedIndexHier {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const modules: ParsedModuleWithSections[] = [];
  let currentModule: ParsedModuleWithSections | null = null;
  let currentSection: ParsedSection | null = null;

  const pushSection = () => {
    if (currentModule && currentSection && currentSection.tags.length) {
      currentModule.sections.push(currentSection);
    }
    currentSection = null;
  };

  const pushModule = () => {
    if (currentModule) {
      // se havia uma seção aberta, finalize
      pushSection();
      modules.push(currentModule);
    }
    currentModule = null;
  };

  for (const rawLine of lines) {
    const line = rawLine;
    const level = getHeadingLevel(line, opts);
    if (level != null) {
      if (level === 1) {
        // novo módulo
        pushModule();
        currentModule = {
          title: stripHeadingTitle(line) || "Sem Título",
          sections: [],
        };
        currentSection = null;
      } else {
        // nova seção/submódulo dentro do módulo atual
        if (!currentModule) {
          // sem módulo atual, ignore seções de topo
          continue;
        }
        pushSection();
        currentSection = {
          title: stripHeadingTitle(line) || "Seção",
          tags: [],
        };
      }
      continue;
    }
    const tags = line.match(TAG_REGEX) || [];
    if (tags.length) {
      if (!currentModule) {
        // ignore tags antes do primeiro módulo
        continue;
      }
      if (!currentSection) {
        currentSection = { title: "Geral", tags: [] };
      }
      currentSection.tags.push(...tags);
    }
  }
  // finalize seção e módulo
  pushModule();
  return { modules };
}
