import { Global, Module } from '@nestjs/common';
import { Clock, IdGenerator, SystemClock, UuidV7Generator } from '../kernel';

@Global()
@Module({
  providers: [
    { provide: Clock, useClass: SystemClock },
    { provide: IdGenerator, useClass: UuidV7Generator },
  ],
  exports: [Clock, IdGenerator],
})
export class CoreModule {}
