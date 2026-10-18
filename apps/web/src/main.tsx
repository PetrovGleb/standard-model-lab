/* Web entry point: mounts the application with the opening splash laid over it. */
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { Splash } from './components/splash';
import './styles.css';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('Root element missing');
}
createRoot(root).render(
  <>
    <App />
    <Splash />
  </>,
);
