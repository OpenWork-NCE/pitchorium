import { encode } from 'uqr';

/**
 * QR code of the second factor, drawn as one SVG path from the modules computed in the browser
 * (uqr): the secret never leaves the page. Dark modules on a light square, in any theme, for the
 * cameras.
 */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { data, size } = encode(value, { border: 2, ecc: 'M' });
  let path = '';
  data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) path += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="bg-white text-black size-48 rounded-md"
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
