/**
 * Rules of the web app that no published plugin covers (docs/architecture/frontend.md). Both are
 * proved by apps/web/test/architecture/eslint-rules.spec.ts on deliberate violations.
 */

const LETTER = /\p{L}/u;

/** Attributes read by people: their value must come from the translations. */
const TEXT_ATTRIBUTES = new Set([
  'alt',
  'title',
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'placeholder',
  'label',
]);

/** Static text of a literal or of a template without expression; undefined otherwise. */
function staticText(node) {
  if (!node) return undefined;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map((quasi) => quasi.value.cooked ?? '').join('');
  }
  if (node.type === 'JSXExpressionContainer') return staticText(node.expression);
  return undefined;
}

const noLiteralUiText = {
  meta: {
    type: 'problem',
    docs: { description: 'Interface text comes from the catalogues of @pitchorium/i18n.' },
    schema: [],
    messages: {
      text: 'Hard-coded interface text "{{text}}": use a translation key (next-intl).',
    },
  },
  create(context) {
    function check(node, text) {
      if (text !== undefined && LETTER.test(text)) {
        context.report({ node, messageId: 'text', data: { text: text.trim().slice(0, 40) } });
      }
    }
    return {
      JSXText(node) {
        check(node, node.value);
      },
      JSXExpressionContainer(node) {
        if (node.parent?.type === 'JSXElement' || node.parent?.type === 'JSXFragment') {
          check(node, staticText(node.expression));
        }
      },
      JSXAttribute(node) {
        const name = node.name.type === 'JSXIdentifier' ? node.name.name : undefined;
        if (name && TEXT_ATTRIBUTES.has(name)) check(node, staticText(node.value));
      },
    };
  },
};

/** Files of the App Router that render a whole route: they stay Server Components. */
const ROUTE_FILE = /[\\/]app[\\/].*(page|layout|template|default|not-found|loading)\.tsx$/;

const noClientRouteFile = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A page or a layout stays a Server Component: move the interactive part into a client component.',
    },
    schema: [],
    messages: {
      client:
        '"use client" on a whole route file: move the interactive part into a client component, or justify the exception with an eslint-disable comment.',
    },
  },
  create(context) {
    if (!ROUTE_FILE.test(context.filename)) return {};
    return {
      Program(program) {
        const directive = program.body.find(
          (statement) =>
            statement.type === 'ExpressionStatement' && statement.directive === 'use client',
        );
        if (directive) context.report({ node: directive, messageId: 'client' });
      },
    };
  },
};

export default {
  meta: { name: 'pitchorium' },
  rules: {
    'no-literal-ui-text': noLiteralUiText,
    'no-client-route-file': noClientRouteFile,
  },
};
