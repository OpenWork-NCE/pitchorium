import { InteractiveRuntime } from '../interactive-runtime';
import { MemberFrame, type MemberFrameProps } from './member-frame';

/**
 * Shell of the member space (ADR 0099): its runtime (messages, toasts), then the client frame
 * (data, realtime, URL state, announcements, shortcuts, header, banners) and the page, which
 * renders its own `main` (page-layouts.tsx).
 */
export function MemberShell(props: MemberFrameProps) {
  return (
    <InteractiveRuntime scope="member">
      <MemberFrame {...props} />
    </InteractiveRuntime>
  );
}
