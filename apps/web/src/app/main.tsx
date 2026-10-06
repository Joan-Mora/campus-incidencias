import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import '../styles/index.css';
import { Providers } from './providers';
import { DeviceGate } from './DeviceGate';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <DeviceGate />
    </Providers>
  </StrictMode>,
);
