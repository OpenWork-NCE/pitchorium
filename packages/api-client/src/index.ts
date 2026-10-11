// One module per tag of the api (orval `tags-split`): a page only carries the tags it imports
// (FRONT 7, A2).
export * from './generated';
export * from './generated/api.schemas';
export {
  ApiProblemError,
  configureApiClient,
  type ApiClientOptions,
  type ApiRequestInfo,
} from './http/fetcher';
