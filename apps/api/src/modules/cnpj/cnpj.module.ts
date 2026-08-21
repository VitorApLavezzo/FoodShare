import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CnpjService } from './cnpj.service';
import { CnpjController } from './cnpj.controller';

@Module({
  imports: [HttpModule],
  controllers: [CnpjController],
  providers: [CnpjService],
  exports: [CnpjService],
})
export class CnpjModule {}
