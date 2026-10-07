import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  createRewardRequestSchema,
  projectIdParamsSchema,
  type ProjectReward,
  projectRewardParamsSchema,
  projectRewardSchema,
  updateRewardRequestSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { DomainError } from '../../../platform/kernel';
import { rewardView } from '../application/project-reads.service';
import { ProjectRepository } from '../application/ports';
import { RewardsService } from '../application/rewards.service';
import { ProjectResolver } from './project.resolver';

class RewardDto extends createZodDto(projectRewardSchema) {}
class CreateRewardDto extends createZodDto(createRewardRequestSchema) {}
class UpdateRewardDto extends createZodDto(updateRewardRequestSchema) {}
class ProjectIdParamsDto extends createZodDto(projectIdParamsSchema) {}
class RewardParamsDto extends createZodDto(projectRewardParamsSchema) {}

/** Rewards (section 11.3): minimum amount, eligible instruments, limited or unlimited quantity. */
@ApiTags('projects')
@Controller('projects/:projectId/rewards')
export class RewardsController {
  constructor(
    private readonly rewards: RewardsService,
    private readonly projects: ProjectRepository,
  ) {}

  @Post()
  @RequireAction('project.update', { resource: ProjectResolver })
  @Idempotent()
  @ZodSerializerDto(RewardDto)
  @ApiCreatedResponse({ type: RewardDto.Output })
  async create(
    @Param() params: ProjectIdParamsDto,
    @Body() body: CreateRewardDto,
  ): Promise<ProjectReward> {
    const reward = await this.rewards.create(params.projectId, body);
    return rewardView(reward, body.minAmount.currency);
  }

  @Patch(':rewardId')
  @RequireAction('project.update', { resource: ProjectResolver })
  @ZodSerializerDto(RewardDto)
  @ApiOkResponse({ type: RewardDto.Output })
  async update(
    @Param() params: RewardParamsDto,
    @Body() body: UpdateRewardDto,
  ): Promise<ProjectReward> {
    await this.rewards.update(params.projectId, params.rewardId, body);
    const [reward, project] = await Promise.all([
      this.projects.findReward(params.rewardId),
      this.projects.findProject(params.projectId),
    ]);
    if (!reward || !project) throw new DomainError('PROJECTS_REWARD_NOT_FOUND', 'Reward not found');
    return rewardView(reward, project.currency);
  }

  /** A reward with reservations cannot be deleted. */
  @Delete(':rewardId')
  @RequireAction('project.update', { resource: ProjectResolver })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async delete(@Param() params: RewardParamsDto): Promise<void> {
    await this.rewards.delete(params.projectId, params.rewardId);
  }
}
