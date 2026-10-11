// Types of scripts/marketing-previews.mjs.
export const PREVIEW_IDS: string[];
export const THEMES: ('light' | 'dark')[];
export const WIDTHS: number[];
export const FORMATS: ('avif' | 'webp')[];
export const SCALE: number;
export function widthsOf(rawWidth: number): number[];
export function fileName(id: string, theme: string, width: number, format: string): string;
export function heightOf(raw: { width: number; height: number }, width: number): number;
