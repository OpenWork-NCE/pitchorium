/**
 * Public facade of the discovery feature: the global search and its palette, the results page,
 * the Discover page and the suggestions with their reason.
 */
export { GlobalSearch, type PaletteProps } from './components/global-search';
export { DiscoverPage, DiscoverSectionGrid } from './components/discover-page';
export { LazyProjectContributors } from './components/lazy-project-contributors';
export { ResultCard, ResultGrid } from './components/result-card';
export { ResultsMore } from './components/search-more';
export { SearchBrowser } from './components/search-browser';
export { SearchPalette } from './components/search-palette';
export { SearchResults } from './components/search-results';
export { DISCOVER_SECTIONS, type DiscoverSection } from './lib/kinds';
export { readSearchFilters, searchApiQuery, type SearchFilters } from './lib/search-query';
export { SuggestionItem } from './components/suggestion-item';
export { SuggestionsList } from './components/suggestions-list';
export { useSuggestionReason } from './components/use-suggestion-reason';
