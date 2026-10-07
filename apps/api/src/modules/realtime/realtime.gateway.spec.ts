import { RealtimeGateway } from './realtime.gateway';

/**
 * O socket.io entrega eventos enquanto `handleConnection` ainda está pendente,
 * e o cliente dispara `conversation:open` assim que conecta. Quando o userId
 * era gravado depois dos awaits, esse evento chegava com o socket anônimo e era
 * recusado — a conversa nunca entrava na sala e o aviso de mensagem nova não
 * era suprimido com o chat aberto.
 */
describe('RealtimeGateway - identidade do socket', () => {
  function buildGateway() {
    const jwtService = { verify: jest.fn().mockReturnValue({ sub: 'user-1' }) };
    const config = { get: jest.fn().mockReturnValue('segredo') };
    const prisma = {
      organizationUser: { findMany: jest.fn().mockResolvedValue([{ organizationId: 'org-1' }]) },
    };
    const chatService = {};
    return new RealtimeGateway(jwtService as never, config as never, prisma as never, chatService as never);
  }

  it('marca o usuário no socket antes do primeiro await', async () => {
    const gateway = buildGateway();
    let liberarJoin!: () => void;
    const portao = new Promise<void>((resolve) => {
      liberarJoin = resolve;
    });

    const client = {
      id: 'sock-1',
      handshake: { auth: { token: 'token-valido' } },
      data: {} as { userId?: string },
      join: jest.fn(() => portao),
      disconnect: jest.fn(),
    };

    const pendente = gateway.handleConnection(client as never);

    // Ainda parado no primeiro `join`: é exatamente a janela em que o
    // `conversation:open` do cliente chegava.
    expect(client.data.userId).toBe('user-1');

    liberarJoin();
    await pendente;
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('entra nas salas das organizações do usuário', async () => {
    const gateway = buildGateway();
    const client = {
      id: 'sock-2',
      handshake: { auth: { token: 'token-valido' } },
      data: {} as { userId?: string },
      join: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
    };

    await gateway.handleConnection(client as never);

    expect(client.join).toHaveBeenCalledWith('user:user-1');
    expect(client.join).toHaveBeenCalledWith('org:org-1');
  });

  it('derruba a conexão quando o token não vale', async () => {
    const gateway = buildGateway();
    const client = {
      id: 'sock-3',
      handshake: { auth: { token: 'token-ruim' } },
      data: {} as { userId?: string },
      join: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
    };
    (gateway as unknown as { jwtService: { verify: jest.Mock } }).jwtService.verify.mockImplementation(() => {
      throw new Error('inválido');
    });

    await gateway.handleConnection(client as never);
    expect(client.disconnect).toHaveBeenCalled();
  });
});
