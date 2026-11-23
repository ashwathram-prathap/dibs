import { cleanHandle } from '../shared/handles';
export function Handle({ name, founder }: { name: string; founder?: boolean | number }) {
  return (
    <span className={'player-handle' + (founder ? ' founder-handle' : '')}>
      {cleanHandle(name)}
      {!!founder && <small className="founder-stamp">FOUNDER</small>}
    </span>
  );
}
