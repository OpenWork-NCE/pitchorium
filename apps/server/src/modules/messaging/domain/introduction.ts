import type {
  IntroductionAnswer,
  IntroductionRole,
  IntroductionStatus,
} from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';

export interface IntroductionRecord {
  id: string;
  introducerId: string;
  firstId: string;
  secondId: string;
  note: string;
  firstAnswer: IntroductionAnswer;
  secondAnswer: IntroductionAnswer;
  status: IntroductionStatus;
  conversationId: string | null;
  createdAt: Date;
  decidedAt: Date | null;
}

/** Two other distinct members, both connected to the introducer (ADR 0058). */
export function assertIntroducible(input: {
  introducerId: string;
  firstId: string;
  secondId: string;
  connectedToFirst: boolean;
  connectedToSecond: boolean;
}): void {
  const { introducerId, firstId, secondId } = input;
  if (firstId === secondId || firstId === introducerId || secondId === introducerId) {
    throw new DomainError('MESSAGING_INTRODUCTION_INVALID', 'Two other distinct members');
  }
  if (!input.connectedToFirst || !input.connectedToSecond) {
    throw new DomainError(
      'MESSAGING_INTRODUCTION_NOT_CONNECTED',
      'The introducer must be connected to both members',
    );
  }
}

export function roleIn(introduction: IntroductionRecord, userId: string): IntroductionRole | null {
  if (introduction.introducerId === userId) return 'introducer';
  if (introduction.firstId === userId) return 'first';
  if (introduction.secondId === userId) return 'second';
  return null;
}

export type AnswerOutcome = 'waiting' | 'completed' | 'declined';

/**
 * Each introduced member answers once; one decline ends the introduction, two acceptances
 * complete it (a group conversation opens).
 */
export function answer(
  introduction: IntroductionRecord,
  role: 'first' | 'second',
  accepted: boolean,
): { firstAnswer: IntroductionAnswer; secondAnswer: IntroductionAnswer; outcome: AnswerOutcome } {
  const current = role === 'first' ? introduction.firstAnswer : introduction.secondAnswer;
  if (introduction.status !== 'pending' || current !== 'pending') {
    throw new DomainError(
      'MESSAGING_INTRODUCTION_ALREADY_ANSWERED',
      'The introduction was already answered',
    );
  }
  const given: IntroductionAnswer = accepted ? 'accepted' : 'declined';
  const firstAnswer = role === 'first' ? given : introduction.firstAnswer;
  const secondAnswer = role === 'second' ? given : introduction.secondAnswer;
  const outcome: AnswerOutcome = !accepted
    ? 'declined'
    : firstAnswer === 'accepted' && secondAnswer === 'accepted'
      ? 'completed'
      : 'waiting';
  return { firstAnswer, secondAnswer, outcome };
}
