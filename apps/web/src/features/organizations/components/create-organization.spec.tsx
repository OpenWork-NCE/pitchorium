// @vitest-environment jsdom
import type * as ApiClient from '@pitchorium/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/support/render';
import { CreateOrganizationForm as CreateOrganization } from './create-organization-form';

const create = vi.hoisted(() => vi.fn());

vi.mock('@pitchorium/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  organizationsControllerCreate: create,
  useProfilesControllerReferenceData: () => ({ data: { countries: [], sectors: [] } }),
}));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe('creation of an organisation', () => {
  it('keeps the first step until its name, type and countries are given', async () => {
    renderWithProviders(
      <QueryClientProvider client={new QueryClient()}>
        <CreateOrganization />
      </QueryClientProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(screen.getByLabelText('Nom de l’organisation').getAttribute('aria-invalid')).toBe(
      'true',
    );
    expect(screen.queryByLabelText('Présentation')).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});
