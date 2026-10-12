import { BrandMicro } from '@/components/brand';
import { Container } from '../container';

export function Footer() {
  return (
    <footer className="border-t border-border">
      <Container className="flex h-16 items-center">
        <BrandMicro size={24} />
      </Container>
    </footer>
  );
}

/**
 * The content of a shell whose header holds the logo and whose footer holds the mark: at least the
 * screen under the header (72 px and its border), so that the footer, and its mark, never share
 * the first screen with the logo of the header (one logo per screen, direction.md).
 */
export const BELOW_FIRST_SCREEN = 'min-h-[calc(100dvh-4.5rem-1px)]';

/** Brand motif of the kit (overlay), on public and authentication pages. */
export const MOTIF =
  'bg-[url(/brand/overlay-mobile.svg)] bg-cover bg-bottom bg-no-repeat md:bg-[url(/brand/overlay-desktop.svg)] md:bg-right';
