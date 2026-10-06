import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { rethrowPrisma } from '../../common/prisma-errors';
import { Page } from '../../common/dto/pagination.dto';
import {
  CreateCustomerDto,
  ListCustomersDto,
  UpdateCustomerDto,
} from './dto/customer.dto';
import { Prisma } from '../../../generated/prisma/client';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListCustomersDto): Promise<Page<any>> {
    const where: Prisma.CustomerWhereInput = {
      tenant_id: tenantId,
      deleted_at: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { code: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
              { gstin: { contains: query.q, mode: 'insensitive' } },
              { phone: { contains: query.q } },
            ],
          }
        : {}),
    };

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        take: limit,
        skip: offset,
        include: { _count: { select: { orders: true } } },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async get(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      include: { _count: { select: { orders: true } } },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async create(tenantId: string, dto: CreateCustomerDto) {
    try {
      return await this.prisma.customer.create({
        data: { ...dto, tenant_id: tenantId },
      });
    } catch (error) {
      rethrowPrisma(error, 'Customer');
    }
  }

  async update(tenantId: string, id: string, dto: UpdateCustomerDto) {
    await this.get(tenantId, id);
    try {
      return await this.prisma.customer.update({ where: { id }, data: dto });
    } catch (error) {
      rethrowPrisma(error, 'Customer');
    }
  }

  /** Soft delete, refused while orders reference the customer. */
  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    const orders = await this.prisma.order.count({
      where: { customer_id: id, deleted_at: null },
    });
    if (orders > 0) {
      throw new ConflictException(
        `Customer has ${orders} order(s) and cannot be deleted. ` +
          `Set status to INACTIVE to stop using it.`,
      );
    }
    await this.prisma.customer.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    return { id, deleted: true };
  }
}
