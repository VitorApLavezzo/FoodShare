import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrivacyService } from './privacy.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PrivacyService],
  exports: [UsersService],
})
export class UsersModule {}
