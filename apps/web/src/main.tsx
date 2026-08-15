import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { App } from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Revalida em segundo plano periodicamente e sempre que a aba ganha foco —
      // sem isso, uma mudança feita por outro usuário (ex.: ONG reservando uma
      // doação) só apareceria depois de um F5 manual.
      refetchInterval: 8000,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
