import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { fetchMyOrganization } from './organizations';

/**
 * A organização do doador/ONG logado. Uma chave só para painel, cabeçalho,
 * conta e guarda de rota — todos leem o mesmo cache, sem requisição repetida.
 */
export function useMyOrganization() {
  const { user } = useAuth();
  const kind = user?.role === 'NGO' ? 'NGO' : 'DONOR';
  const query = useQuery({
    queryKey: ['my-organization', kind],
    queryFn: () => fetchMyOrganization(kind),
    enabled: user?.role === 'DONOR' || user?.role === 'NGO',
  });
  return { ...query, kind } as const;
}

/**
 * Doador e ONG só circulam pelo sistema depois de cadastrar a organização: sem
 * ela não há o que ver no mapa, nem doação para abrir, e a conta mostraria
 * metade das seções vazias. Até lá, só o painel (onde fica o formulário).
 */
export function useOrganizationGate() {
  const { user } = useAuth();
  const query = useMyOrganization();
  const needsOrganization = user?.role === 'DONOR' || user?.role === 'NGO';
  return {
    isChecking: needsOrganization && query.isLoading,
    isComplete: !needsOrganization || !!query.data,
  };
}
