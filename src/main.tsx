import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {IconContext} from '@phosphor-icons/react';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IconContext.Provider value={{weight: 'duotone'}}>
      <App />
    </IconContext.Provider>
  </StrictMode>,
);
