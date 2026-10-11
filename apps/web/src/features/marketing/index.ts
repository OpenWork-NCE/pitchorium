/** Public facade of the marketing feature: the editorial pages and the legal pages (ADR 0156). */
export { HomePage } from './components/home-page';
export { HowItWorksPage } from './components/how-it-works-page';
export { LegalPage } from './components/legal-page';
export { SiteFooter } from './components/site-footer';
export { TransparencyPage } from './components/transparency-page';
export {
  isLegalDocument,
  LEGAL_DOCUMENTS,
  type LegalDocument,
  versionShown,
} from './lib/legal-documents';
export { loadLegalDocument } from './lib/load-legal';
