import { cleanHandle } from '../shared/handles';
export function Handle({ name, founder }: { name: string; founder?: boolean | number }) {
  return (
    <span className={founder ? 'founder-handle' : undefined}>
      {cleanHandle(name)}
      {!!founder && <small className="founder-stamp">FOUNDER</small>}
    </span>
  );
}
