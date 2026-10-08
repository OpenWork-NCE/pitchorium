import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Put, Query } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type Block,
  blockPageSchema,
  type CursorPage,
  cursorPageQuerySchema,
  memberHandleParamsSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { BlocksService } from '../application/blocks.service';

class BlockPageDto extends createZodDto(blockPageSchema) {}
class MemberHandleParamsDto extends createZodDto(memberHandleParamsSchema) {}
class PageQueryDto extends createZodDto(cursorPageQuerySchema) {}

/** Blocking (ADR 0029). Reporting belongs to the trust module. */
@ApiTags('network')
@Controller()
export class BlocksController {
  constructor(private readonly blocks: BlocksService) {}

  @Put('network/blocks/:handle')
  @RequireAction('network.block')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async block(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MemberHandleParamsDto,
  ): Promise<void> {
    await this.blocks.block(principal.userId, params.handle);
  }

  @Delete('network/blocks/:handle')
  @RequireAction('network.block')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async unblock(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MemberHandleParamsDto,
  ): Promise<void> {
    await this.blocks.unblock(principal.userId, params.handle);
  }

  @Get('me/network/blocks')
  @RequireAction('network.read')
  @ZodSerializerDto(BlockPageDto)
  @ApiOkResponse({ type: BlockPageDto.Output })
  list(
    @CurrentPrincipal() principal: Principal,
    @Query() query: PageQueryDto,
  ): Promise<CursorPage<Block>> {
    return this.blocks.list(principal.userId, query);
  }
}
