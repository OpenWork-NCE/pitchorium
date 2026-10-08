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

/** Brand motif of the kit (overlay), on public and authentication pages. */
export const MOTIF =
  'bg-[url(/brand/overlay-mobile.svg)] bg-cover bg-bottom bg-no-repeat md:bg-[url(/brand/overlay-desktop.svg)] md:bg-right';
