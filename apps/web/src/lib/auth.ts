import { api } from './api';

export async function checkEmailAvailability(email: string): Promise<boolean> {
  const { data } = await api.get<{ available: boolean }>('/auth/email-availability', { params: { email } });
  return data.available;
}
