import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common'
import { z } from 'zod'
import { RequestContext } from '../../../../../common/types/request-context'
import { AuthGuard } from '../../../../../common/guards/auth.guard'
import { TenantGuard } from '../../../../../common/guards/tenant.guard'
import { RequirePermission, RoleGuard } from '../../../../../common/guards/role.guard'
import { ZodValidationPipe } from '../../../../../common/pipes/zod-validation.pipe'
import { CreateCategorySchema, UpdateCategorySchema } from '../../../../../common/shared-schemas'
import { CategoryService } from '../../../application/category.service'

type CreateCategoryBody = z.infer<typeof CreateCategorySchema>
type UpdateCategoryBody = z.infer<typeof UpdateCategorySchema>

@Controller('categories')
@UseGuards(AuthGuard, TenantGuard, RoleGuard)
export class CategoriesController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @RequirePermission('category:read')
  async listCategories(@Req() req: RequestContext) {
    const categories = await this.categoryService.listCategories(req.tenantId as string)
    return { data: { categories } }
  }

  @Get(':id')
  @RequirePermission('category:read')
  async getCategory(@Req() req: RequestContext, @Param('id') id: string) {
    const category = await this.categoryService.findByIdForTenant(id, req.tenantId as string)
    return { data: { category } }
  }

  @Post()
  @RequirePermission('category:write')
  @UsePipes(new ZodValidationPipe(CreateCategorySchema))
  async createCategory(@Req() req: RequestContext, @Body() body: CreateCategoryBody) {
    const category = await this.categoryService.createCategory({
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      correlationId: req.requestId ?? 'unknown',
      name: body.name,
      type: body.type,
      color: body.color,
    })
    return { data: { category } }
  }

  @Patch(':id')
  @RequirePermission('category:write')
  async updateCategory(
    @Req() req: RequestContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCategorySchema)) body: UpdateCategoryBody,
  ) {
    const category = await this.categoryService.updateCategory({
      id,
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      correlationId: req.requestId ?? 'unknown',
      name: body.name,
      color: body.color,
    })
    return { data: { category } }
  }

  @Delete(':id')
  @RequirePermission('category:write')
  async deleteCategory(@Req() req: RequestContext, @Param('id') id: string) {
    await this.categoryService.deleteCategory({
      id,
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      correlationId: req.requestId ?? 'unknown',
    })
    return { data: { deleted: true } }
  }
}
