import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { GererExports } from '../application/services/gerer-exports';
import { EXPORTS_QUEUE } from '../application/services/export.constants';

@Processor(EXPORTS_QUEUE)
export class ExportsProcessor extends WorkerHost {
  constructor(private readonly exports: GererExports) {
    super();
  }

  async process(job: Job<{ exportId: string }>): Promise<void> {
    await this.exports.executer(job.data.exportId);
  }
}
