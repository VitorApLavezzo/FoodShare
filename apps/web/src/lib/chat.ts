import { api } from './api';

export interface Conversation {
  id: string;
  reservationId: string;
  donationListId: string;
  createdAt: string;
  reservation?: { ngoOrganization: { tradeName: string } };
  donationList?: { donorOrganization: { tradeName: string } };
}

export interface Message {
  id: string;
  conversationId: string;
  senderUserId: string;
  body: string;
  createdAt: string;
}

export async function fetchConversations() {
  const { data } = await api.get<Conversation[]>('/conversations');
  return data;
}

export async function fetchMessages(conversationId: string) {
  const { data } = await api.get<Message[]>(`/conversations/${conversationId}/messages`);
  return data;
}

export async function sendMessageRest(conversationId: string, body: string) {
  const { data } = await api.post<Message>(`/conversations/${conversationId}/messages`, { body });
  return data;
}
