import type { ProblemDetails } from '@pitchorium/contracts';

/** A field error of a problem document, its JSON pointer turned into a form path. */
export interface FieldIssue {
  /** Dotted path of react-hook-form (`members.0.email`), the root form for an empty pointer. */
  path: string;
  code: string;
}

/** `/members/0/email` to `members.0.email`, with the escapes of RFC 6901 undone. */
export function pointerToPath(pointer: string): string {
  return pointer
    .split('/')
    .slice(1)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
    .join('.');
}

/** The field errors of a validation problem (RFC 9457 `errors`), in the order of the api. */
export function fieldIssues(problem: ProblemDetails): FieldIssue[] {
  return (problem.errors ?? []).map((issue) => ({
    path: pointerToPath(issue.pointer),
    code: issue.code,
  }));
}
