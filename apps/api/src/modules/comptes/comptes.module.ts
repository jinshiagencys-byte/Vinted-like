import { Module } from '@nestjs/common';
import type { VerificateurMotDePasseCompromis } from './domain/ports';
import {
  ADRESSE_REPOSITORY,
  APPAREIL_REPOSITORY,
  HACHEUR_MOT_DE_PASSE,
  PROFIL_REPOSITORY,
  REINITIALISATION_REPOSITORY,
  UTILISATEUR_REPOSITORY,
  VERIFICATION_REPOSITORY,
  VERIFICATEUR_MOT_DE_PASSE_COMPROMIS,
} from './domain/ports';
import { PolitiqueAdresse } from './domain/policies/politique-adresse';
import { PolitiqueMotDePasse } from './domain/policies/politique-mot-de-passe';
import { PolitiqueSession } from './domain/policies/politique-session';
import { PolitiqueSuppression } from './domain/policies/politique-suppression';
import { PolitiqueVerification } from './domain/policies/politique-verification';
import { AdressePrismaRepository } from './infrastructure/persistance/prisma/adresse.prisma.repository';
import { AppareilPrismaRepository } from './infrastructure/persistance/prisma/appareil.prisma.repository';
import { ProfilPrismaRepository } from './infrastructure/persistance/prisma/profil.prisma.repository';
import { ReinitialisationPrismaRepository } from './infrastructure/persistance/prisma/reinitialisation.prisma.repository';
import { UtilisateurPrismaRepository } from './infrastructure/persistance/prisma/utilisateur.prisma.repository';
import { VerificationPrismaRepository } from './infrastructure/persistance/prisma/verification.prisma.repository';
import { HacheurMotDePasseArgon2 } from './infrastructure/securite/hacheur-mot-de-passe-argon2';
import { VerificateurCompromisHibp } from './infrastructure/securite/verificateur-compromis-hibp';

const repositories = [
  UtilisateurPrismaRepository,
  ProfilPrismaRepository,
  AdressePrismaRepository,
  AppareilPrismaRepository,
  VerificationPrismaRepository,
  ReinitialisationPrismaRepository,
];

@Module({
  providers: [
    ...repositories,
    HacheurMotDePasseArgon2,
    VerificateurCompromisHibp,
    { provide: UTILISATEUR_REPOSITORY, useExisting: UtilisateurPrismaRepository },
    { provide: PROFIL_REPOSITORY, useExisting: ProfilPrismaRepository },
    { provide: ADRESSE_REPOSITORY, useExisting: AdressePrismaRepository },
    { provide: APPAREIL_REPOSITORY, useExisting: AppareilPrismaRepository },
    { provide: VERIFICATION_REPOSITORY, useExisting: VerificationPrismaRepository },
    {
      provide: REINITIALISATION_REPOSITORY,
      useExisting: ReinitialisationPrismaRepository,
    },
    { provide: HACHEUR_MOT_DE_PASSE, useExisting: HacheurMotDePasseArgon2 },
    {
      provide: VERIFICATEUR_MOT_DE_PASSE_COMPROMIS,
      useExisting: VerificateurCompromisHibp,
    },
    PolitiqueVerification,
    PolitiqueSession,
    PolitiqueSuppression,
    PolitiqueAdresse,
    {
      provide: PolitiqueMotDePasse,
      inject: [VERIFICATEUR_MOT_DE_PASSE_COMPROMIS],
      useFactory: (verificateur: VerificateurMotDePasseCompromis) =>
        new PolitiqueMotDePasse(verificateur),
    },
  ],
  exports: [
    ...repositories,
    UTILISATEUR_REPOSITORY,
    PROFIL_REPOSITORY,
    ADRESSE_REPOSITORY,
    APPAREIL_REPOSITORY,
    VERIFICATION_REPOSITORY,
    REINITIALISATION_REPOSITORY,
    HACHEUR_MOT_DE_PASSE,
    VERIFICATEUR_MOT_DE_PASSE_COMPROMIS,
    PolitiqueVerification,
    PolitiqueSession,
    PolitiqueSuppression,
    PolitiqueAdresse,
    PolitiqueMotDePasse,
  ],
})
export class ComptesModule {}
