import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Bell, BellOff } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { moneyFormatOptions, minorStep } from '@/lib/format/money';
import { AnimatedNumber } from './animated-number';
import { IconSwap } from './icon-swap';
import { Reveal } from './reveal';
import { SplitHeading } from './split-heading';

const meta = { title: 'Motion/Primitives' } satisfies Meta;
export default meta;

/** scale 0.25 to 1 with a 4 px blur, spring without bounce. */
export const IconSwapStory: StoryObj = {
  name: 'Icon swap',
  render: function Render() {
    const [on, setOn] = useState(true);
    return (
      <Button variant="secondary" size="icon" aria-label="Notifications" onClick={() => setOn(!on)}>
        <IconSwap state={on ? 'on' : 'off'}>
          {on ? <Bell aria-hidden /> : <BellOff aria-hidden />}
        </IconSwap>
      </Button>
    );
  },
};

const count = new Intl.NumberFormat('fr');
const xaf = new Intl.NumberFormat('fr', moneyFormatOptions('XAF'));
const eur = new Intl.NumberFormat('fr', moneyFormatOptions('EUR'));

/** H17: snapped to the minor unit of each currency, formatted on every frame. */
export const Counter: StoryObj = {
  render: () => (
    <div className="grid gap-4 font-display text-4xl">
      <AnimatedNumber value={1284} format={(value) => count.format(value)} />
      <AnimatedNumber
        value={2500000}
        step={minorStep('XAF')}
        format={(value) => xaf.format(value)}
      />
      <AnimatedNumber
        value={12500.5}
        step={minorStep('EUR')}
        format={(value) => eur.format(value)}
      />
    </div>
  ),
};

/** E1: scroll-driven where supported, IntersectionObserver otherwise. Scroll the canvas. */
export const RevealOnScroll: StoryObj = {
  render: () => (
    <div className="grid gap-6">
      <div className="h-[80vh]" />
      {[1, 2, 3].map((item) => (
        <Reveal key={item}>
          <Card>Bloc {item}</Card>
        </Reveal>
      ))}
    </div>
  ),
};

/** H13 with GSAP SplitText, loaded on demand: public editorial pages only. */
export const EditorialHeading: StoryObj = {
  render: () => (
    <div>
      <div className="h-[90vh]" />
      <SplitHeading className="max-w-2xl text-4xl">
        Des profils, des projets et des personnes à rencontrer.
      </SplitHeading>
      <div className="h-[40vh]" />
    </div>
  ),
};
