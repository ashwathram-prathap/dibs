import { CREATOR_URL, X_URL } from '../shared/creator';

export function CreatorLinks() {
  return (
    <>
      <a href={CREATOR_URL} target="_blank" rel="noopener noreferrer">
        Ashwathram Prathap
      </a>
      <a
        className="creator-x"
        href={X_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Ashwathram Prathap on X"
      >
        X
      </a>
    </>
  );
}

export function BuilderNote() {
  return (
    <p className="builder-note">
      Dibs is built by{' '}
      <a href={CREATOR_URL} target="_blank" rel="noopener noreferrer">
        Ashwathram Prathap
      </a>
      , a student at the University of Waterloo.{' '}
      <a
        className="creator-x"
        href={X_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Ashwathram Prathap on X"
      >
        X
      </a>
    </p>
  );
}
