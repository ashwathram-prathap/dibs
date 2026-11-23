import { RouteBoundary } from './RouteBoundary';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
if (navigator.hardwareConcurrency <= 2) document.documentElement.classList.add('low-power');
let slowFrames = 0,
  lastFrame = performance.now(),
  sampledFrames = 0;
function sampleFrame(t: number) {
  if (t - lastFrame > 35) slowFrames++;
  lastFrame = t;
  if (++sampledFrames < 16) requestAnimationFrame(sampleFrame);
  else if (slowFrames > 6) document.documentElement.classList.add('low-power');
}
requestAnimationFrame(sampleFrame);
createRoot(document.getElementById('root')!).render(
  <RouteBoundary>
    <App />
  </RouteBoundary>,
);
