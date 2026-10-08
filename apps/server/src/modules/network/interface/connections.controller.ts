import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type ConnectionRequest,
  connectionRequestPageSchema,
  connectionRequestParamsSchema,
  connectionRequestSchema,
  connectionRequestsQuerySchema,
  createConnectionRequestSchema,
  type CursorPage,
  cursorPageQuerySchema,
  memberHandleParamsSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { ConnectionsService } from '../application/connections.service';
import { NetworkReadsService } from '../application/network-reads.service';

class ConnectionRequestDto extends createZodDto(connectionRequestSchema) {}
class ConnectionRequestPageDto extends createZodDto(connectionRequestPageSchema) {}
class CreateConnectionRequestDto extends createZodDto(createConnectionRequestSchema) {}
class ConnectionRequestParamsDto extends createZodDto(connectionRequestParamsSchema) {}
class MemberHandleParamsDto extends createZodDto(memberHandleParamsSchema) {}
class RequestsQueryDto extends createZodDto(
  cursorPageQuerySchema.extend(connectionRequestsQuerySchema.shape),
) {}

/** Connection requests and connections (§10.2, ADR 0028). */
@ApiTags('network')
@Controller()
export class ConnectionsController {
  constructor(
    private readonly connections: ConnectionsService,
    private readonly reads: NetworkReadsService,
  ) {}

  /** Sends a request with an optional note, or accepts the pending request of the member. */
  @Post('network/connection-requests')
  @RequireAction('network.connection.request')
  @Idempotent()
  @ZodSerializerDto(ConnectionRequestDto)
  @ApiCreatedResponse({ type: ConnectionRequestDto.Output })
  request(
    @CurrentPrincipal() principal: Principal,
    @Body() body: CreateConnectionRequestDto,
  ): Promise<ConnectionRequest> {
    return this.connections.request(principal.userId, body);
  }

  /** Pending requests of the member, received (default) or sent. */
  @Get('me/network/connection-requests')
  @RequireAction('network.read')
  @ZodSerializerDto(ConnectionRequestPageDto)
  @ApiOkResponse({ type: ConnectionRequestPageDto.Output })
  list(
    @CurrentPrincipal() principal: Principal,
    @Query() query: RequestsQueryDto,
  ): Promise<CursorPage<ConnectionRequest>> {
    return this.reads.requests(principal.userId, query.direction, query);
  }

  @Post('network/connection-requests/:requestId/accept')
  @RequireAction('network.connection.respond')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(ConnectionRequestDto)
  @ApiOkResponse({ type: ConnectionRequestDto.Output })
  accept(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ConnectionRequestParamsDto,
  ): Promise<ConnectionRequest> {
    return this.connections.accept(principal.userId, params.requestId);
  }

  @Post('network/connection-requests/:requestId/decline')
  @RequireAction('network.connection.respond')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async decline(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ConnectionRequestParamsDto,
  ): Promise<void> {
    await this.connections.decline(principal.userId, params.requestId);
  }

  /** Withdrawal by the requester. */
  @Delete('network/connection-requests/:requestId')
  @RequireAction('network.connection.respond')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async withdraw(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ConnectionRequestParamsDto,
  ): Promise<void> {
    await this.connections.withdraw(principal.userId, params.requestId);
  }

  @Delete('network/connections/:handle')
  @RequireAction('network.connection.remove')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MemberHandleParamsDto,
  ): Promise<void> {
    await this.connections.remove(principal.userId, params.handle);
  }
}
