import { Injectable } from '@nestjs/common';
import { ServiceSessions } from '../services/service-sessions';

@Injectable()
export class Deconnecter {
  constructor(private readonly sessions: ServiceSessions) {}

  async executer(utilisateurId: string, appareilId: string | undefined): Promise<void> {
    if (appareilId) {
      await this.sessions.revoquer(utilisateurId, appareilId);
    }
  }
}
