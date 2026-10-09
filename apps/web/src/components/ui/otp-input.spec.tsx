// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/support/render';
import { OtpInput } from './otp-input';

function Code({ onComplete }: { onComplete: (value: string) => void }) {
  const [value, setValue] = useState('');
  return <OtpInput aria-label="Code" value={value} onChange={setValue} onComplete={onComplete} />;
}

function boxes(container: HTMLElement) {
  return [...container.querySelectorAll('span[aria-hidden]')].filter((box) =>
    box.className.includes('size-12'),
  );
}

describe('OtpInput', () => {
  it('takes a pasted code at once, keeps digits only, fills the boxes one after the other', () => {
    const complete = vi.fn();
    const { container } = renderWithProviders(<Code onComplete={complete} />);
    const input = screen.getByRole('textbox', { name: 'Code' });
    fireEvent.change(input, { target: { value: '12 34-56' } });
    expect(input).toHaveProperty('value', '123456');
    expect(complete).toHaveBeenCalledWith('123456');
    const filled = boxes(container);
    expect(filled.map((box) => box.textContent)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(filled.every((box) => box.hasAttribute('data-pasted'))).toBe(true);
  });

  it('moves the focus ring box by box while typing, and back with Backspace', () => {
    const complete = vi.fn();
    const { container } = renderWithProviders(<Code onComplete={complete} />);
    const input = screen.getByRole('textbox', { name: 'Code' });
    fireEvent.focus(input);
    const active = () => boxes(container).findIndex((box) => box.hasAttribute('data-active'));
    expect(active()).toBe(0);
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.change(input, { target: { value: '42' } });
    expect(active()).toBe(2);
    expect(boxes(container).some((box) => box.hasAttribute('data-pasted'))).toBe(false);
    fireEvent.change(input, { target: { value: '4' } });
    expect(active()).toBe(1);
    expect(complete).not.toHaveBeenCalled();
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect(input.getAttribute('inputmode')).toBe('numeric');
  });
});
