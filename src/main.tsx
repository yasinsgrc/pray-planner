import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {IconContext} from './components/icons';
import {MotionConfig} from 'motion/react';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <IconContext.Provider value={{weight: 'duotone'}}>
        <App />
      </IconContext.Provider>
    </MotionConfig>
  </StrictMode>,
);
