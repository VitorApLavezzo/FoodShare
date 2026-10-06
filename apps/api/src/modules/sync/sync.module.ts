import { forwardRef, Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [forwardRef(() => RealtimeModule)],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
