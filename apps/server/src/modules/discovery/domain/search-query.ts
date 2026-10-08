/**
 * Weights of the search (ADR 0066): the name or title (A) before the subtitle (B), before the
 * description (C), before the labels of sectors and countries (D). They are the `ts_rank_cd`
 * weights, in the {D, C, B, A} order PostgreSQL expects.
 */
export const DOCUMENT_WEIGHTS = { A: 1, B: 0.4, C: 0.2, D: 0.1 } as const;

export const RANK_WEIGHTS_ARRAY = `{${DOCUMENT_WEIGHTS.D},${DOCUMENT_WEIGHTS.C},${DOCUMENT_WEIGHTS.B},${DOCUMENT_WEIGHTS.A}}`;

/**
 * Trigram similarity of the query with the name (tolerance to typos), and bonus of a name that
 * starts with the query: they rank names first, whatever the length of the description.
 */
export const NAME_SIMILARITY_WEIGHT = 0.6;
export const NAME_PREFIX_BONUS = 0.4;
/** word_similarity from which a name matches despite typos (pg_trgm `<%`, default 0.6). */
export const NAME_SIMILARITY_THRESHOLD = 0.5;

/** Words of a query taken into account; beyond, the query is cut. */
export const QUERY_MAX_TERMS = 8;

/**
 * Lower case without accents, as `lower(unaccent(...))` on the indexed side: `Sénégal Énergie`
 * gives `senegal energie`.
 */
export function normalizeQuery(query: string): string {
  return query.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Terms of a normalized query: letters and digits only. */
export function queryTerms(normalized: string): string[] {
  return (normalized.match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, QUERY_MAX_TERMS);
}

/**
 * Prefix full-text query of the `simple` configuration: every term, each as a prefix
 * (`irrig:* & sahel:*`), so that a word being typed already matches. Null without term.
 */
export function prefixTsQuery(normalized: string): string | null {
  const terms = queryTerms(normalized);
  return terms.length === 0 ? null : terms.map((term) => `${term}:*`).join(' & ');
}

/**
 * Score of a result, the formula of the SQL query: full-text rank, plus the similarity of the
 * name, plus a bonus when the name starts with the query. Kept here to document and test the
 * order of the results.
 */
export function searchScore(input: {
  textRank: number;
  nameSimilarity: number;
  namePrefix: boolean;
}): number {
  return (
    input.textRank +
    NAME_SIMILARITY_WEIGHT * input.nameSimilarity +
    (input.namePrefix ? NAME_PREFIX_BONUS : 0)
  );
}
