'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import type { RefObject } from 'react';
import { gsapEasePath, seconds } from './tokens';

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, CustomEase);
CustomEase.create('pitchorium-enter', gsapEasePath('enter'));

/**
 * GSAP side of SplitHeading, loaded on demand by the public editorial pages only (E3, D4):
 * lines masked and raised with a stagger when the heading enters, rewound when scrolling back.
 */
export default function SplitAnimator({ target }: { target: RefObject<HTMLElement | null> }) {
  useGSAP(
    () => {
      const element = target.current;
      if (!element) return;
      SplitText.create(element, {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        // A GSAP tween is thenable; SplitText needs it back to revert it before a new split.
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onSplit: (self) =>
          gsap.from(self.lines, {
            yPercent: 110,
            stagger: 0.08,
            duration: seconds('reveal') * 1.5,
            ease: 'pitchorium-enter',
            scrollTrigger: {
              trigger: element,
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          }),
      });
    },
    { scope: target },
  );
  return null;
}
