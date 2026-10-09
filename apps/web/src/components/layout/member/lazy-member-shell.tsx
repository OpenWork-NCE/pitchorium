import { InteractiveRuntime } from '../interactive-runtime';
import { LazyMemberFrame } from './lazy-member-frame';
import type { MemberFrameProps } from './member-frame';

/**
 * The member shell for the pages of a resource (ADR 0101): its client frame is loaded on demand,
 * so that the visitors of these pages never download it. Never import member-frame.tsx here: a
 * static import would put it back in the first load of the group.
 */
export function LazyMemberShell(props: MemberFrameProps) {
  return (
    <InteractiveRuntime scope="member">
      <LazyMemberFrame {...props} />
    </InteractiveRuntime>
  );
}
