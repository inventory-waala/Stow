import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { rethrowPrisma } from '../../common/prisma-errors';
import { Page } from '../../common/dto/pagination.dto';
import {
  CreateSupplierDto,
  ListSuppliersDto,
  UpdateSupplierDto,
} from './dto/supplier.dto';
import { Prisma } from '../../../generated/prisma/client';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListSuppliersDto): Promise<Page<any>> {
    const where: Prisma.SupplierWhereInput = {
      tenant_id: tenantId,
      deleted_at: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { code: { contains: query.q, mode: 'insensitive' } },
              { gstin: { contains: query.q, mode: 'insensitive' } },
              { phone: { contains: query.q } },
            ],
          }
        : {}),
    };

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const [items, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        take: limit,
        skip: offset,
        include: { _count: { select: { purchases: true } } },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async get(tenantId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
      include: { _count: { select: { purchases: true } } },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async create(tenantId: string, dto: CreateSupplierDto) {
    try {
      return await this.prisma.supplier.create({
        data: { ...dto, tenant_id: tenantId },
      });
    } catch (error) {
      rethrowPrisma(error, 'Supplier');
    }
  }

  async update(tenantId: string, id: string, dto: UpdateSupplierDto) {
    await this.get(tenantId, id);
    try {
      return await this.prisma.supplier.update({ where: { id }, data: dto });
    } catch (error) {
      rethrowPrisma(error, 'Supplier');
    }
  }

  /**
   * Soft delete. A supplier with purchase orders is kept so those documents
   * keep their counterparty; it is marked INACTIVE instead of being removed,
   * which is also why purchase_orders.supplier_id uses onDelete: Restrict.
   */
  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    const purchases = await this.prisma.purchaseOrder.count({
      where: { supplier_id: id, deleted_at: null },
    });
    if (purchases > 0) {
      throw new ConflictException(
        `Supplier has ${purchases} purchase order(s) and cannot be deleted. ` +
          `Set status to INACTIVE to stop using it.`,
      );
    }
    await this.prisma.supplier.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    return { id, deleted: true };
  }
}
