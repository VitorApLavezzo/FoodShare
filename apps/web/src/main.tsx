import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { App } from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // O tempo real chega por WebSocket (notificações e chat invalidam as
      // queries na hora). O polling fica só como rede de segurança, mais
      // espaçado e parado em segundo plano — a cada 8s em todas as telas,
      // inclusive com a aba escondida, era tráfego e bateria à toa.
      refetchInterval: 60_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
      staleTime: 10_000,
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
