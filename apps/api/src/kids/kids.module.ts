import { Module } from '@nestjs/common';
import { KidsService } from './kids.service';
import { KidsController } from './kids.controller';

@Module({
  controllers: [KidsController],
  providers: [KidsService],
  exports: [KidsService],
})
export class KidsModule {}
