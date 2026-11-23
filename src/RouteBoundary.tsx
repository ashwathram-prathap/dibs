import { Component, type ReactNode } from 'react';
// Explicit reload only: old cached chunks must never trigger a reload loop.
export class RouteBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section role="alert" className="route-recovery">
        <h1>A new version is available. Reload</h1>
        <button onClick={() => location.reload()}>Reload</button>
      </section>
    ) : (
      this.props.children
    );
  }
}
