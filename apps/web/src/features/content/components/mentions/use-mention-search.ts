'use client';

import { discoveryControllerAutocomplete } from '@pitchorium/api-client';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/** A member or an organization that may be mentioned. */
export interface MentionOption {
  kind: 'member' | 'organization';
  /** Handle of a member, slug of an organization: what the text carries. */
  key: string;
  label: string;
  subtitle: string | null;
}

const DEBOUNCE_MS = 150;

/**
 * Members and organizations whose name starts with what is typed after `@`, from the search of
 * the api (discovery): the members blocked on either side are never in it.
 */
export function useMentionSearch(query: string | null): {
  options: MentionOption[];
  loading: boolean;
} {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);
  const search = useQuery({
    queryKey: ['content', 'mentions', debounced],
    queryFn: ({ signal }) =>
      discoveryControllerAutocomplete(
        { q: debounced ?? '', kinds: 'person,organization', limit: 6 },
        { signal },
      ),
    enabled: Boolean(debounced),
    staleTime: 60_000,
  });
  return {
    options: (search.data?.items ?? []).flatMap((item): MentionOption[] =>
      item.kind === 'person' || item.kind === 'organization'
        ? [
            {
              kind: item.kind === 'person' ? 'member' : 'organization',
              key: item.key,
              label: item.title,
              subtitle: item.subtitle,
            },
          ]
        : [],
    ),
    loading: search.isFetching,
  };
}
