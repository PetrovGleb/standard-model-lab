/* ESLint rule: every file starts with one short block comment on line 1 and contains no other comments. */
const MAX_HEADER_LINES = 3;

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Allow only a single short header block comment on line 1' },
    schema: [],
    messages: {
      missingHeader: 'File must start with a /* ... */ header comment describing what it is.',
      headerTooLong: 'Header comment must be at most {{max}} lines.',
      extraComment: 'Comments are not allowed outside the file header.',
    },
  },
  create(context) {
    return {
      Program() {
        const comments = context.sourceCode.getAllComments();
        const [first] = comments;
        const hasHeader =
          first !== undefined && first.type === 'Block' && first.loc.start.line === 1;
        if (!hasHeader) {
          context.report({ loc: { line: 1, column: 0 }, messageId: 'missingHeader' });
        } else if (first.loc.end.line - first.loc.start.line + 1 > MAX_HEADER_LINES) {
          context.report({
            loc: first.loc,
            messageId: 'headerTooLong',
            data: { max: MAX_HEADER_LINES },
          });
        }
        comments.slice(hasHeader ? 1 : 0).forEach((comment) => {
          context.report({ loc: comment.loc, messageId: 'extraComment' });
        });
      },
    };
  },
};
