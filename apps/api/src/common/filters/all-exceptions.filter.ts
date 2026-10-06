import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  correlationId?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = request.headers['x-correlation-id'] as string | undefined;

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Erro interno do servidor.';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
        code = HttpStatus[status] ?? 'ERROR';
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj.message as string) ?? exception.message;
        code = (resObj.code as string) ?? HttpStatus[status] ?? 'ERROR';
        details = resObj.details ?? (Array.isArray(resObj.message) ? resObj.message : undefined);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Sem isso, "registro não encontrado" e "violação de unicidade" chegavam
      // ao cliente como 500 genérico, sem nada acionável.
      if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'NOT_FOUND';
        message = 'Registro não encontrado.';
      } else if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'ALREADY_EXISTS';
        message = 'Já existe um registro com esses dados.';
        details = exception.meta?.target;
      } else if (exception.code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;
        code = 'INVALID_REFERENCE';
        message = 'Referência inválida para um registro relacionado.';
      }
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status} [${correlationId ?? 'no-correlation-id'}]`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorBody = {
      success: false,
      error: { code, message, details },
      correlationId,
    };

    response.status(status).json(body);
  }
}
