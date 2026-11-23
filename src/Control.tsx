import type { ReactNode, SelectHTMLAttributes } from 'react';
import { Icon } from './Icon';

export function ThemeSwatch({ target }: { target: 'light' | 'dark' }) {
  return <span className={'theme-swatch swatch-' + target} aria-hidden="true" />;
}

// The native menu remains accessible; its closed face can wrap instead of clipping.
export function SelectControl({
  display,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { display: ReactNode }) {
  return (
    <span className="select-control">
      <span className="control-face" aria-hidden="true">
        {display}
      </span>
      <select {...props}>{children}</select>
      <Icon name="chevron" />
    </span>
  );
}
