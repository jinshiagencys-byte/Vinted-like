import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { OutboxPublisher } from './outbox.publisher';
import { OutboxService } from './outbox.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'outbox' })],
  providers: [OutboxService, OutboxPublisher, InboxService],
  exports: [OutboxService, OutboxPublisher, InboxService],
})
export class OutboxModule {}
