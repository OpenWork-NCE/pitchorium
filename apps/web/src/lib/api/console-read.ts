import { ApiProblemError } from '@pitchorium/api-client';
import { notFound } from 'next/navigation';

/**
 * A reading of a screen of the console (ADR 0172): a resource the api does not find, an
 * identifier it refuses, or a screen whose action the reader does not hold answers 404, as the
 * console does for a member without a role; any other failure goes to the error boundary.
 */
export async function consoleRead<T>(call: Promise<T>): Promise<T> {
  try {
    return await call;
  } catch (error) {
    if (
      error instanceof ApiProblemError &&
      (error.problem.status === 404 ||
        error.problem.status === 400 ||
        error.problem.code === 'FORBIDDEN')
    ) {
      notFound();
    }
    throw error;
  }
}
