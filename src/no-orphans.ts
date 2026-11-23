import { useLayoutEffect } from 'react';
import { noOrphan } from '../shared/text';
/** React keeps ownership of nodes: only change a text node's space, never its structure.
 * This also handles the final pair split by an inline <strong> or a dynamic component.
 * Measure the pair in its actual font; narrow containers keep a breakable space.
 */
export function useNoOrphans() {
  useLayoutEffect(() => {
    const root = document.getElementById('root')!;
    const changed = new Map<Text, { before: string; after: string }>();
    let frame = 0;
    const selector =
      '.player-handle,p,h1,h2,h3,h4,h5,h6,button,summary,label,figcaption,li,td,th,a,small,.opening-notice,.cert-footer > span,.reveal-time span';
    function apply() {
      frame = 0;
      observer.disconnect();
      for (const el of root.querySelectorAll<HTMLElement>(selector)) {
        if (
          !el.getClientRects().length ||
          el.closest('svg,pre,code,textarea,select,[data-orphans="off"]')
        )
          continue;
        // The innermost block owns its sentence. Inline emphasis still belongs to its parent.
        if (el.querySelector('.player-handle,p,h1,h2,h3,h4,h5,h6,li,table,button')) continue;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const nodes: Text[] = [];
        while (walker.nextNode()) nodes.push(walker.currentNode as Text);
        const text = nodes.map((n) => n.data).join('');
        const next = noOrphan(text, Number.POSITIVE_INFINITY);
        if (next === text) continue;
        let index = 0;
        while (index < text.length && text[index] === next[index]) index++;
        if (index < 0) continue;
        const pairStart = text.lastIndexOf(' ', index - 1) + 1;
        let offset = 0,
          start: Text | undefined,
          end: Text | undefined,
          startOffset = 0,
          endOffset = 0,
          space: Text | undefined,
          spaceOffset = 0;
        for (const node of nodes) {
          if (!start && offset + node.length > pairStart) {
            start = node;
            startOffset = pairStart - offset;
          }
          if (!space && offset + node.length > index) {
            space = node;
            spaceOffset = index - offset;
          }
          if (node.length) {
            end = node;
            endOffset = node.length;
          }
          offset += node.length;
        }
        if (!start || !end || !space) continue;
        // Measure text-node fragments, not element rects (which double-count inline emphasis).
        let width = 0,
          measuring = false;
        for (const node of nodes) {
          if (node === start) measuring = true;
          if (!measuring || !node.length) continue;
          const range = document.createRange();
          range.setStart(node, node === start ? startOffset : 0);
          range.setEnd(node, node === end ? endOffset : node.length);
          width += Array.from(range.getClientRects()).reduce((n, r) => n + r.width, 0);
          if (node === end) break;
        }
        const style = getComputedStyle(el);
        const available = el.clientWidth || el.parentElement!.clientWidth;
        if (
          width + parseFloat(style.fontSize) * 0.5 >
          available - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
        )
          continue;
        const before = space.data,
          after = before.slice(0, spaceOffset) + '\u00a0' + before.slice(spaceOffset + 1);
        changed.set(space, { before, after });
        space.data = after;
      }
      observer.observe(root, { childList: true, subtree: true, characterData: true });
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const reset = () => {
      observer.disconnect();
      for (const [node, value] of changed)
        if (node.isConnected && node.data === value.after) node.data = value.before;
      changed.clear();
      apply();
    };
    const observer = new MutationObserver(schedule);
    apply();
    void document.fonts.ready.then(reset);
    let fontSize = getComputedStyle(document.documentElement).fontSize;
    const sizes = new ResizeObserver(() => {
      const current = getComputedStyle(document.documentElement).fontSize;
      if (current !== fontSize) {
        fontSize = current;
        reset();
      }
    });
    sizes.observe(root);
    window.addEventListener('resize', reset);
    return () => {
      observer.disconnect();
      sizes.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', reset);
    };
  }, []);
}
