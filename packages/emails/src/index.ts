import { createElement } from 'react';
import { renderEmail, type RenderedEmail } from './render.js';
import TechnicalTestEmail, {
  technicalTestSubject,
  type TechnicalTestEmailProps,
} from './templates/technical-test.js';

export type { RenderedEmail } from './render.js';
export type { TechnicalTestEmailProps } from './templates/technical-test.js';

export function renderTechnicalTestEmail(props: TechnicalTestEmailProps): Promise<RenderedEmail> {
  return renderEmail(technicalTestSubject(props.locale), createElement(TechnicalTestEmail, props));
}
