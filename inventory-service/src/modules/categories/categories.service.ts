import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { rethrowPrisma } from '../../common/prisma-errors';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { Prisma } from '../../../generated/prisma/client';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.category.findMany({
      where: { tenant_id: tenantId },
      orderBy: [{ parent_id: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true, children: true } } },
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.category.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!row) throw new NotFoundException('Category not found');
    return row;
  }

  async create(tenantId: string, dto: CreateCategoryDto) {
    if (dto.parent_id) await this.get(tenantId, dto.parent_id);
    try {
      return await this.prisma.category.create({
        data: {
          tenant_id: tenantId,
          slug: dto.slug,
          name: dto.name,
          description: dto.description,
          parent_id: dto.parent_id,
          attributes: (dto.attributes ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      rethrowPrisma(e, 'Category');
    }
  }

  async update(tenantId: string, id: string, dto: UpdateCategoryDto) {
    await this.get(tenantId, id);
    if (dto.parent_id) {
      if (dto.parent_id === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }
      await this.get(tenantId, dto.parent_id);
      if (await this.isDescendant(dto.parent_id, id)) {
        throw new BadRequestException(
          'Cannot move a category under one of its own descendants',
        );
      }
    }
    try {
      return await this.prisma.category.update({
        where: { id },
        data: {
          slug: dto.slug,
          name: dto.name,
          description: dto.description,
          parent_id: dto.parent_id,
          attributes: dto.attributes as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      rethrowPrisma(e, 'Category');
    }
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    const [children, products] = await Promise.all([
      this.prisma.category.count({ where: { parent_id: id } }),
      this.prisma.product.count({ where: { category_id: id, deleted_at: null } }),
    ]);
    if (children > 0 || products > 0) {
      throw new ConflictException(
        `Category has ${children} sub-categories and ${products} products; move them first`,
      );
    }
    await this.prisma.category.delete({ where: { id } });
    return { id };
  }

  /** Walks up from `candidate` to see whether `ancestor` is above it. */
  private async isDescendant(candidate: string, ancestor: string) {
    let current: string | null = candidate;
    for (let depth = 0; current && depth < 64; depth++) {
      if (current === ancestor) return true;
      const row: { parent_id: string | null } | null =
        await this.prisma.category.findUnique({
          where: { id: current },
          select: { parent_id: true },
        });
      current = row?.parent_id ?? null;
    }
    return false;
  }
}
