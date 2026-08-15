import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function buildContext(user: unknown): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('permite acesso quando a rota não declara @Roles', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext({ role: 'DONOR' }))).toBe(true);
  });

  it('permite acesso quando o papel do usuário está na lista exigida', () => {
    const reflector = { getAllAndOverride: () => [UserRole.ADMIN] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext({ role: 'ADMIN' }))).toBe(true);
  });

  it('bloqueia acesso quando o papel do usuário não está na lista exigida', () => {
    const reflector = { getAllAndOverride: () => [UserRole.ADMIN] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(buildContext({ role: 'DONOR' }))).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: 'FORBIDDEN_ROLE' }) }),
    );
  });

  it('bloqueia acesso quando não há usuário autenticado no request', () => {
    const reflector = { getAllAndOverride: () => [UserRole.ADMIN] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow();
  });
});
