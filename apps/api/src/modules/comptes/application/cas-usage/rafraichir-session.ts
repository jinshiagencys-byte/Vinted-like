import { Injectable } from '@nestjs/common';
import type { SessionEmise } from '../types';
import { ServiceSessions } from '../services/service-sessions';
import { LimiteurDebitService } from '../../infrastructure/securite/limiteur-debit.service';

@Injectable()
export class RafraichirSession {
  constructor(
    private readonly sessions: ServiceSessions,
    private readonly limiteur: LimiteurDebitService,
  ) {}

  async executer(refreshToken: string, ip: string): Promise<SessionEmise> {
    await this.limiteur.consommer(`refresh:${LimiteurDebitService.empreinte(ip)}`, 30, 60);

    return this.sessions.rafraichir(refreshToken);
  }
}
