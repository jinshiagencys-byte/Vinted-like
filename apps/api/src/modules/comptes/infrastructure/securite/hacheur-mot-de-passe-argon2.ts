import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import type { HacheurMotDePasse } from '../../domain/ports';
import type { MotDePasse } from '../../domain/value-objects/mot-de-passe';

@Injectable()
export class HacheurMotDePasseArgon2 implements HacheurMotDePasse {
  async hacher(motDePasse: MotDePasse): Promise<string> {
    return argon2.hash(motDePasse.reveler(), {
      type: argon2.argon2id,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    });
  }

  async verifier(hash: string, motDePasse: MotDePasse): Promise<boolean> {
    try {
      return await argon2.verify(hash, motDePasse.reveler());
    } catch {
      return false;
    }
  }
}
