import { rarityTier, tierCopy, momentum } from '../shared/flow-rules';
import type { Claim, DayFile } from './types';
export function ClaimTier({ claim, file }: { claim: Claim; file?: DayFile | null }) {
  const tier = rarityTier(claim.percentile, claim.pool);
  if (!tier) return null;
  return (
    <div className={'claim-tier' + (tier === 'Off the register' ? ' off-register-moment' : '')}>
      <strong className={tier === 'Off the register' ? 'off-register-stamp' : 'tier-stamp'}>
        {tier}
      </strong>
      {tier === 'Off the register' && (
        <>
          <p>{tierCopy(claim)}</p>
          {claim.offRegisterOrdinal && (
            <p>Off-register player #{claim.offRegisterOrdinal} tonight.</p>
          )}
        </>
      )}
      {file &&
        momentum(file.claims, file.strikes, file.closed).map((text) => <p key={text}>{text}</p>)}
    </div>
  );
}
export function TitleStamp({ file }: { file: DayFile }) {
  const title = file.title;
  if (!title) return null;
  return (
    <div className={'title-award' + (file.claims.some((c) => c.golden) ? ' gold-title' : '')}>
      <strong
        className={'title-stamp' + (title.name === 'Dibillionaire' ? ' dibillionaire-stamp' : '')}
      >
        {title.name}
        {title.name === 'Dibillionaire' ? '.' : ''}
      </strong>
      <p>
        {title.reason}
        {title.provisional ? ' · so far' : ''}
      </p>
    </div>
  );
}
