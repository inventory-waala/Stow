import { ConflictException, NotFoundException } from '@nestjs/common';

/**
 * Translates the Prisma error codes we expect from ordinary writes into HTTP
 * responses; anything else is rethrown untouched so it surfaces as a 500.
 */
export function rethrowPrisma(error: any, entity: string): never {
  if (error?.code === 'P2002') {
    const target = Array.isArray(error?.meta?.target)
      ? error.meta.target.join(', ')
      : String(error?.meta?.target ?? '');
    throw new ConflictException(
      `${entity} already exists${target ? ` (${target})` : ''}`,
    );
  }
  if (error?.code === 'P2025') {
    throw new NotFoundException(`${entity} not found`);
  }
  if (error?.code === 'P2003') {
    throw new ConflictException(
      `${entity} is referenced by other records and cannot be changed this way`,
    );
  }
  throw error;
}
