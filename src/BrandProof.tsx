export function BrandProof() {
  return (
    <section className="brand-proof">
      <h1>Two papers from the same office.</h1>
      <p>Design specimens · not player records</p>
      <div className="brand-directions">
        {['a', 'b'].map((direction, i) => (
          <article className={'direction direction-' + direction} key={direction}>
            <span className="eyebrow">
              {i === 0 ? 'A · Engraver’s office' : 'B · Field register'}
            </span>
            <div className="proof-heading">
              <h2>Animals</h2>
              <img
                src={'/art/animals-' + direction + '.svg'}
                alt="Original engraved animal plate"
              />
            </div>
            <span className="proof-stamp">DIBS</span>
            <div className="proof-bottom">
              <p>
                First come.
                <br />
                First served.
              </p>
              <img src={'/art/seal-' + direction + '.svg'} alt="Registry of Dibs seal" />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
