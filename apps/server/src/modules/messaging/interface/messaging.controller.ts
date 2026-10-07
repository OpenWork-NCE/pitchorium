import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type Conversation,
  conversationIdParamsSchema,
  conversationListQuerySchema,
  conversationPageSchema,
  conversationSchema,
  type CursorPage,
  cursorPageQuerySchema,
  editMessageRequestSchema,
  type Introduction,
  introductionIdParamsSchema,
  introductionPageSchema,
  introductionSchema,
  type Message,
  messageIdParamsSchema,
  messageListQuerySchema,
  type MessagePage,
  messagePageSchema,
  messageSchema,
  type MessagingSettings,
  messagingSettingsSchema,
  proposeIntroductionRequestSchema,
  readConversationRequestSchema,
  sendMessageRequestSchema,
  startConversationRequestSchema,
  updateConversationRequestSchema,
  uuidV7Schema,
} from '@pitchorium/contracts';
import type { Request } from 'express';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  CurrentPrincipal,
  type Principal,
  type ProtectedResource,
  RequireAction,
  type ResourceResolver,
} from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { ConversationAccess } from '../application/conversation-access';
import { ConversationsService } from '../application/conversations.service';
import { IntroductionsService } from '../application/introductions.service';
import { MessagingRepository } from '../application/ports';
import { roleIn } from '../domain/introduction';

class ConversationDto extends createZodDto(conversationSchema) {}
class ConversationPageDto extends createZodDto(conversationPageSchema) {}
class ConversationListQueryDto extends createZodDto(conversationListQuerySchema) {}
class ConversationIdParamsDto extends createZodDto(conversationIdParamsSchema) {}
class MessageIdParamsDto extends createZodDto(messageIdParamsSchema) {}
class MessageDto extends createZodDto(messageSchema) {}
class MessagePageDto extends createZodDto(messagePageSchema) {}
class MessageListQueryDto extends createZodDto(messageListQuerySchema) {}
class StartConversationDto extends createZodDto(startConversationRequestSchema) {}
class SendMessageDto extends createZodDto(sendMessageRequestSchema) {}
class EditMessageDto extends createZodDto(editMessageRequestSchema) {}
class ReadConversationDto extends createZodDto(readConversationRequestSchema) {}
class ReadResultDto extends createZodDto(z.object({ sequence: z.number().int() })) {}
class UpdateConversationDto extends createZodDto(updateConversationRequestSchema) {}
class MessagingSettingsDto extends createZodDto(messagingSettingsSchema) {}
class ProposeIntroductionDto extends createZodDto(proposeIntroductionRequestSchema) {}
class IntroductionDto extends createZodDto(introductionSchema) {}
class IntroductionPageDto extends createZodDto(introductionPageSchema) {}
class IntroductionIdParamsDto extends createZodDto(introductionIdParamsSchema) {}
class CursorPageQueryDto extends createZodDto(cursorPageQuerySchema) {}

const idParam = (request: Request, name: string): string | null => {
  const parsed = uuidV7Schema.safeParse(request.params[name]);
  return parsed.success ? parsed.data : null;
};

/** A conversation the member sees: `participant`; 404 otherwise (blocks included). */
@Injectable()
export class ConversationResolver implements ResourceResolver {
  constructor(private readonly access: ConversationAccess) {}

  async resolve(request: Request, principal: Principal): Promise<ProtectedResource | null> {
    const id = idParam(request, 'conversationId');
    if (!id || !(await this.access.find(principal.userId, id))) return null;
    return { type: 'conversation', id, ownerId: null, roles: ['participant'] };
  }
}

/** A message of a conversation the member sees: `sender` for its author. */
@Injectable()
export class MessageResolver implements ResourceResolver {
  constructor(
    private readonly access: ConversationAccess,
    private readonly messaging: MessagingRepository,
  ) {}

  async resolve(request: Request, principal: Principal): Promise<ProtectedResource | null> {
    const conversationId = idParam(request, 'conversationId');
    const messageId = idParam(request, 'messageId');
    if (!conversationId || !messageId) return null;
    const message = await this.messaging.findMessage(messageId);
    if (message?.conversationId !== conversationId) return null;
    if (!(await this.access.find(principal.userId, conversationId))) return null;
    const sender = message.senderId === principal.userId;
    return {
      type: 'message',
      id: messageId,
      ownerId: message.senderId,
      roles: sender ? ['sender', 'participant'] : ['participant'],
    };
  }
}

/** A pending message request: `request_recipient` for its recipient only. */
@Injectable()
export class RequestResolver implements ResourceResolver {
  constructor(private readonly messaging: MessagingRepository) {}

  async resolve(request: Request, principal: Principal): Promise<ProtectedResource | null> {
    const id = idParam(request, 'conversationId');
    if (!id) return null;
    const conversation = await this.messaging.findConversation(id);
    if (conversation?.status !== 'request') return null;
    if (conversation.requestRecipientId !== principal.userId) return null;
    return { type: 'conversation', id, ownerId: null, roles: ['request_recipient'] };
  }
}

/** An introduction: `introduced` for the two members introduced; 404 for anyone else. */
@Injectable()
export class IntroductionResolver implements ResourceResolver {
  constructor(private readonly messaging: MessagingRepository) {}

  async resolve(request: Request, principal: Principal): Promise<ProtectedResource | null> {
    const id = idParam(request, 'introductionId');
    if (!id) return null;
    const introduction = await this.messaging.findIntroduction(id);
    const role = introduction ? roleIn(introduction, principal.userId) : null;
    if (!role) return null;
    return {
      type: 'introduction',
      id,
      ownerId: introduction?.introducerId ?? null,
      roles: role === 'introducer' ? [] : ['introduced'],
    };
  }
}

/** Messaging (§10.4): conversations, messages, requests, settings and introductions. */
@ApiTags('messaging')
@Controller()
export class MessagingController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly introductions: IntroductionsService,
  ) {}

  @Get('messaging/conversations')
  @RequireAction('messaging.read')
  @ZodSerializerDto(ConversationPageDto)
  @ApiOkResponse({ type: ConversationPageDto.Output })
  list(
    @CurrentPrincipal() principal: Principal,
    @Query() query: ConversationListQueryDto,
  ): Promise<CursorPage<Conversation>> {
    return this.conversations.list(principal.userId, query);
  }

  /** First message to a member, in the direct conversation of the pair (created if needed). */
  @Post('messaging/conversations')
  @RequireAction('messaging.conversation.start')
  @Idempotent()
  @ZodSerializerDto(MessageDto)
  @ApiCreatedResponse({ type: MessageDto.Output })
  start(
    @CurrentPrincipal() principal: Principal,
    @Body() body: StartConversationDto,
  ): Promise<Message> {
    return this.conversations.start(principal.userId, body);
  }

  @Get('messaging/conversations/:conversationId')
  @RequireAction('messaging.conversation.participate', { resource: ConversationResolver })
  @ZodSerializerDto(ConversationDto)
  @ApiOkResponse({ type: ConversationDto.Output })
  get(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ConversationIdParamsDto,
  ): Promise<Conversation> {
    return this.conversations.get(principal.userId, params.conversationId);
  }

  /** Archive, mute, mark unread: the state of the member only. */
  @Patch('messaging/conversations/:conversationId')
  @RequireAction('messaging.conversation.participate', { resource: ConversationResolver })
  @ZodSerializerDto(ConversationDto)
  @ApiOkResponse({ type: ConversationDto.Output })
  update(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ConversationIdParamsDto,
    @Body() body: UpdateConversationDto,
  ): Promise<Conversation> {
    return this.conversations.update(principal.userId, params.conversationId, body);
  }

  @Post('messaging/conversations/:conversationId/leave')
  @RequireAction('messaging.conversation.participate', { resource: ConversationResolver })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async leave(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ConversationIdParamsDto,
  ): Promise<void> {
    await this.conversations.leave(principal.userId, params.conversationId);
  }

  /** History (`beforeSequence`) or the messages after a known sequence (sync). */
  @Get('messaging/conversations/:conversationId/messages')
  @RequireAction('messaging.conversation.participate', { resource: ConversationResolver })
  @ZodSerializerDto(MessagePageDto)
  @ApiOkResponse({ type: MessagePageDto.Output })
  messages(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ConversationIdParamsDto,
    @Query() query: MessageListQueryDto,
  ): Promise<MessagePage> {
    return this.conversations.messages(principal.userId, params.conversationId, query);
  }

  @Post('messaging/conversations/:conversationId/messages')
  @RequireAction('messaging.conversation.participate', { resource: ConversationResolver })
  @Idempotent()
  @ZodSerializerDto(MessageDto)
  @ApiCreatedResponse({ type: MessageDto.Output })
  send(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ConversationIdParamsDto,
    @Body() body: SendMessageDto,
  ): Promise<Message> {
    return this.conversations.send(principal.userId, params.conversationId, body);
  }

  @Post('messaging/conversations/:conversationId/read')
  @RequireAction('messaging.conversation.participate', { resource: ConversationResolver })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(ReadResultDto)
  @ApiOkResponse({ type: ReadResultDto.Output })
  read(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ConversationIdParamsDto,
    @Body() body: ReadConversationDto,
  ): Promise<{ sequence: number }> {
    return this.conversations.read(principal.userId, params.conversationId, body.sequence);
  }

  @Patch('messaging/conversations/:conversationId/messages/:messageId')
  @RequireAction('messaging.message.update', { resource: MessageResolver })
  @ZodSerializerDto(MessageDto)
  @ApiOkResponse({ type: MessageDto.Output })
  edit(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MessageIdParamsDto,
    @Body() body: EditMessageDto,
  ): Promise<Message> {
    return this.conversations.edit(
      principal.userId,
      params.conversationId,
      params.messageId,
      body.body,
    );
  }

  @Delete('messaging/conversations/:conversationId/messages/:messageId')
  @RequireAction('messaging.message.update', { resource: MessageResolver })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(
    @CurrentPrincipal() principal: Principal,
    @Param() params: MessageIdParamsDto,
  ): Promise<void> {
    await this.conversations.delete(principal.userId, params.conversationId, params.messageId);
  }

  @Post('messaging/conversations/:conversationId/accept')
  @RequireAction('messaging.request.respond', { resource: RequestResolver })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async accept(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ConversationIdParamsDto,
  ): Promise<void> {
    await this.conversations.respond(principal.userId, params.conversationId, true);
  }

  /** Silent for the sender, who keeps seeing the request as sent. */
  @Post('messaging/conversations/:conversationId/decline')
  @RequireAction('messaging.request.respond', { resource: RequestResolver })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async decline(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ConversationIdParamsDto,
  ): Promise<void> {
    await this.conversations.respond(principal.userId, params.conversationId, false);
  }

  @Get('me/messaging/settings')
  @RequireAction('messaging.read')
  @ZodSerializerDto(MessagingSettingsDto)
  @ApiOkResponse({ type: MessagingSettingsDto.Output })
  settings(@CurrentPrincipal() principal: Principal): Promise<MessagingSettings> {
    return this.conversations.settings(principal.userId);
  }

  @Put('me/messaging/settings')
  @RequireAction('messaging.settings.update')
  @ZodSerializerDto(MessagingSettingsDto)
  @ApiOkResponse({ type: MessagingSettingsDto.Output })
  updateSettings(
    @CurrentPrincipal() principal: Principal,
    @Body() body: MessagingSettingsDto,
  ): Promise<MessagingSettings> {
    return this.conversations.updateSettings(principal.userId, body);
  }

  @Post('messaging/introductions')
  @RequireAction('messaging.introduction.propose')
  @Idempotent()
  @ZodSerializerDto(IntroductionDto)
  @ApiCreatedResponse({ type: IntroductionDto.Output })
  propose(
    @CurrentPrincipal() principal: Principal,
    @Body() body: ProposeIntroductionDto,
  ): Promise<Introduction> {
    return this.introductions.propose(principal.userId, body);
  }

  /** Introductions the member proposed or received, newest first. */
  @Get('messaging/introductions')
  @RequireAction('messaging.read')
  @ZodSerializerDto(IntroductionPageDto)
  @ApiOkResponse({ type: IntroductionPageDto.Output })
  listIntroductions(
    @CurrentPrincipal() principal: Principal,
    @Query() query: CursorPageQueryDto,
  ): Promise<CursorPage<Introduction>> {
    return this.introductions.list(principal.userId, query);
  }

  @Get('messaging/introductions/:introductionId')
  @RequireAction('messaging.read')
  @ZodSerializerDto(IntroductionDto)
  @ApiOkResponse({ type: IntroductionDto.Output })
  introduction(
    @CurrentPrincipal() principal: Principal,
    @Param() params: IntroductionIdParamsDto,
  ): Promise<Introduction> {
    return this.introductions.get(principal.userId, params.introductionId);
  }

  @Post('messaging/introductions/:introductionId/accept')
  @RequireAction('messaging.introduction.respond', { resource: IntroductionResolver })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(IntroductionDto)
  @ApiOkResponse({ type: IntroductionDto.Output })
  acceptIntroduction(
    @CurrentPrincipal() principal: Principal,
    @Param() params: IntroductionIdParamsDto,
  ): Promise<Introduction> {
    return this.introductions.respond(principal.userId, params.introductionId, true);
  }

  @Post('messaging/introductions/:introductionId/decline')
  @RequireAction('messaging.introduction.respond', { resource: IntroductionResolver })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(IntroductionDto)
  @ApiOkResponse({ type: IntroductionDto.Output })
  declineIntroduction(
    @CurrentPrincipal() principal: Principal,
    @Param() params: IntroductionIdParamsDto,
  ): Promise<Introduction> {
    return this.introductions.respond(principal.userId, params.introductionId, false);
  }
}
