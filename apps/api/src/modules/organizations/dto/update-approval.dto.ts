import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

const APPROVAL_STATUSES = ['APPROVED', 'REJECTED', 'BLOCKED'] as const;

export class UpdateApprovalDto {
  @ApiProperty({ enum: APPROVAL_STATUSES })
  @IsIn(APPROVAL_STATUSES)
  status!: (typeof APPROVAL_STATUSES)[number];
}
