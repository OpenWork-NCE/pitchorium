// Splits the React Query hooks of each generated tag module into its own `<tag>.hooks.ts`, after
// orval (README.md). A tag module that defined a hook imported `useQuery` or `useMutation`, and a
// bundler keeps that import as long as one hook of the module is used anywhere in the app: every
// chunk that only called a fetch function or read a query key of the tag carried the observers of
// TanStack Query (6 kB compressed, ADR 0094). The tag module keeps the requests, the URLs, the keys
// and the options; the hooks module builds on them. Both are exported by src/generated/index.ts.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const root = new URL('../src/generated/', import.meta.url).pathname;

/** The statements of a hook: `function useX` (overloads included) or `const useX = …`. */
function isHook(statement) {
  if (ts.isFunctionDeclaration(statement)) return /^use[A-Z]/.test(statement.name?.text ?? '');
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.some(
      (declaration) => ts.isIdentifier(declaration.name) && /^use[A-Z]/.test(declaration.name.text),
    );
  }
  return false;
}

const isExported = (statement) =>
  statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;

/** The names a statement declares. */
function declaredNames(statement) {
  if (ts.isFunctionDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
    return statement.name ? [statement.name.text] : [];
  }
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations
      .map((declaration) => declaration.name)
      .filter(ts.isIdentifier)
      .map((name) => name.text);
  }
  return [];
}

/** The names a statement exports, to import them from the tag module in the hooks module. */
const exportedNames = (statement) => (isExported(statement) ? declaredNames(statement) : []);

const word = (name) => new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`);

/** The import declarations, with only the names the body uses. */
function importsFor(imports, body, source) {
  const lines = [];
  for (const declaration of imports) {
    const clause = declaration.importClause;
    const bindings = clause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    const used = bindings.elements.filter((element) => word(element.name.text).test(body));
    if (used.length === 0) continue;
    const typeOnly = clause.isTypeOnly ? 'type ' : '';
    const names = used.map((element) => element.getText(source)).join(', ');
    lines.push(
      `import ${typeOnly}{ ${names} } from ${declaration.moduleSpecifier.getText(source)};`,
    );
  }
  return lines.join('\n');
}

const written = [];
for (const tag of readdirSync(root, { withFileTypes: true })) {
  if (!tag.isDirectory()) continue;
  const path = join(root, tag.name, `${tag.name}.ts`);
  const text = readFileSync(path, 'utf8');
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  // The notice of orval, the comment the file opens with.
  const notice = ts.getLeadingCommentRanges(text, 0)?.[0];
  const header = notice ? text.slice(notice.pos, notice.end) : '';
  const imports = source.statements.filter(ts.isImportDeclaration);
  const rest = source.statements.filter((statement) => !ts.isImportDeclaration(statement));
  const hooks = rest.filter(isHook);
  if (hooks.length === 0) continue;
  // Local helpers (`SecondParameter`, `withQueryKey`) go with the statements that use them, to
  // either module or to both, in their order.
  const helpers = rest.filter((statement) => !isHook(statement) && !isExported(statement));
  const withHelpers = (statements) => {
    const kept = new Set(statements);
    for (let grown = true; grown;) {
      grown = false;
      const body = [...kept].map((statement) => statement.getText(source)).join('\n');
      for (const helper of helpers) {
        if (!kept.has(helper) && declaredNames(helper).some((name) => word(name).test(body))) {
          kept.add(helper);
          grown = true;
        }
      }
    }
    return rest.filter((statement) => kept.has(statement));
  };
  const base = withHelpers(rest.filter((statement) => !isHook(statement) && isExported(statement)));
  const hooksAll = withHelpers(hooks);
  // The full text keeps the documentation comment of each statement.
  const textOf = (statements) =>
    statements.map((statement) => statement.getFullText(source).trim()).join('\n\n');
  const baseBody = textOf(base);
  const hooksBody = textOf(hooksAll);
  const fromBase = base
    .flatMap(exportedNames)
    .filter((name) => word(name).test(hooksBody))
    .sort();
  writeFileSync(path, `${header}\n${importsFor(imports, baseBody, source)}\n\n${baseBody}\n`);
  const hooksPath = join(root, tag.name, `${tag.name}.hooks.ts`);
  writeFileSync(
    hooksPath,
    `${header}\n${importsFor(imports, hooksBody, source)}\nimport { ${fromBase.join(', ')} } from './${tag.name}';\n\n${hooksBody}\n`,
  );
  written.push(path, hooksPath);
}

// The index of orval exports the tag modules: their hooks modules follow each one.
const indexPath = join(root, 'index.ts');
const index = readFileSync(indexPath, 'utf8').replace(
  /^export \* from '\.\/([^/]+)\/\1';$/gm,
  (line, tag) =>
    written.includes(join(root, tag, `${tag}.hooks.ts`))
      ? `${line}\nexport * from './${tag}/${tag}.hooks';`
      : line,
);
writeFileSync(indexPath, index);
written.push(indexPath);

execFileSync('prettier', ['--write', '--log-level=warn', ...written], { stdio: 'inherit' });
