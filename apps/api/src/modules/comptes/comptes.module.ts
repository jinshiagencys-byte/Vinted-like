import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../../common/auth/auth.module';
import { OutboxModule } from '../../common/outbox/outbox.module';
import { ChangerMotDePasse } from './application/cas-usage/changer-mot-de-passe';
import { ConfirmerReinitialisation } from './application/cas-usage/confirmer-reinitialisation';
import { Connecter } from './application/cas-usage/connecter';
import { ConsulterMoi } from './application/cas-usage/consulter-moi';
import { ConsulterProfilPublic } from './application/cas-usage/consulter-profil-public';
import { Deconnecter } from './application/cas-usage/deconnecter';
import { DemanderReinitialisation } from './application/cas-usage/demander-reinitialisation';
import { GererAdresses } from './application/cas-usage/gerer-adresses';
import { GererAppareils } from './application/cas-usage/gerer-appareils';
import { InscrireCompte } from './application/cas-usage/inscrire-compte';
import { MettreAJourProfil } from './application/cas-usage/mettre-a-jour-profil';
import { RafraichirSession } from './application/cas-usage/rafraichir-session';
import { RenvoyerCodeEmail } from './application/cas-usage/renvoyer-code-email';
import { RenvoyerCodeTelephone } from './application/cas-usage/renvoyer-code-telephone';
import { SupprimerCompte } from './application/cas-usage/supprimer-compte';
import { VerifierEmail } from './application/cas-usage/verifier-email';
import { VerifierTelephone } from './application/cas-usage/verifier-telephone';
import { ConsommerEvenements } from './application/services/consommer-evenements';
import { EXPORTS_QUEUE } from './application/services/export.constants';
import { GererExports } from './application/services/gerer-exports';
import { ServiceSessions } from './application/services/service-sessions';
import { ServiceSignatureExport } from './application/services/service-signature-export';
import type { VerificateurMotDePasseCompromis } from './domain/ports';
import {
  ADRESSE_REPOSITORY,
  APPAREIL_REPOSITORY,
  COMMANDES_PORT,
  EXPORT_REPOSITORY,
  HACHEUR_MOT_DE_PASSE,
  INSCRIPTION_REPOSITORY,
  LITIGES_PORT,
  NOTIFICATION_PORT,
  PORTEFEUILLE_PORT,
  PROFIL_REPOSITORY,
  REINITIALISATION_REPOSITORY,
  STOCKAGE_EXPORT,
  UTILISATEUR_REPOSITORY,
  VERIFICATION_REPOSITORY,
  VERIFICATEUR_MOT_DE_PASSE_COMPROMIS,
} from './domain/ports';
import { PolitiqueAdresse } from './domain/policies/politique-adresse';
import { PolitiqueMotDePasse } from './domain/policies/politique-mot-de-passe';
import { PolitiqueSession } from './domain/policies/politique-session';
import { PolitiqueSuppression } from './domain/policies/politique-suppression';
import { PolitiqueVerification } from './domain/policies/politique-verification';
import {
  CommandesFakeAdapter,
  LitigesFakeAdapter,
  PortefeuilleFakeAdapter,
} from './infrastructure/adaptateurs/ports-externes.fake';
import { NotificationOutboxAdapter } from './infrastructure/adaptateurs/notification-outbox.adapter';
import { StockageExportLocal } from './infrastructure/adaptateurs/stockage-export.local';
import { AdressePrismaRepository } from './infrastructure/persistance/prisma/adresse.prisma.repository';
import { AppareilPrismaRepository } from './infrastructure/persistance/prisma/appareil.prisma.repository';
import { ExportPrismaRepository } from './infrastructure/persistance/prisma/export.prisma.repository';
import { InscriptionPrismaRepository } from './infrastructure/persistance/prisma/inscription.prisma.repository';
import { ProfilPrismaRepository } from './infrastructure/persistance/prisma/profil.prisma.repository';
import { ReinitialisationPrismaRepository } from './infrastructure/persistance/prisma/reinitialisation.prisma.repository';
import { UtilisateurPrismaRepository } from './infrastructure/persistance/prisma/utilisateur.prisma.repository';
import { VerificationPrismaRepository } from './infrastructure/persistance/prisma/verification.prisma.repository';
import { HacheurMotDePasseArgon2 } from './infrastructure/securite/hacheur-mot-de-passe-argon2';
import { LimiteurDebitService } from './infrastructure/securite/limiteur-debit.service';
import { VerificateurCompromisHibp } from './infrastructure/securite/verificateur-compromis-hibp';
import { AdressesControleur } from './presentation/http/controleurs/adresses.controleur';
import { AppareilsControleur } from './presentation/http/controleurs/appareils.controleur';
import { AuthControleur } from './presentation/http/controleurs/auth.controleur';
import {
  MoiControleur,
  TelechargementExportControleur,
} from './presentation/http/controleurs/moi.controleur';
import { UtilisateursControleur } from './presentation/http/controleurs/utilisateurs.controleur';
import { VersionSecuriteGuard } from './presentation/http/guards/version-securite.guard';
import { ExportsProcessor } from './workers/exports.processor';

const repositories = [
  UtilisateurPrismaRepository,
  ProfilPrismaRepository,
  AdressePrismaRepository,
  AppareilPrismaRepository,
  VerificationPrismaRepository,
  ReinitialisationPrismaRepository,
  InscriptionPrismaRepository,
  ExportPrismaRepository,
];

const casUsage = [
  InscrireCompte,
  VerifierEmail,
  RenvoyerCodeEmail,
  Connecter,
  RafraichirSession,
  Deconnecter,
  VerifierTelephone,
  RenvoyerCodeTelephone,
  DemanderReinitialisation,
  ConfirmerReinitialisation,
  ChangerMotDePasse,
  ConsulterMoi,
  MettreAJourProfil,
  GererAdresses,
  GererAppareils,
  ConsulterProfilPublic,
  SupprimerCompte,
];

@Module({
  imports: [AuthModule, OutboxModule, BullModule.registerQueue({ name: EXPORTS_QUEUE })],
  controllers: [
    AuthControleur,
    MoiControleur,
    TelechargementExportControleur,
    AdressesControleur,
    AppareilsControleur,
    UtilisateursControleur,
  ],
  providers: [
    ...repositories,
    ...casUsage,
    HacheurMotDePasseArgon2,
    VerificateurCompromisHibp,
    NotificationOutboxAdapter,
    StockageExportLocal,
    CommandesFakeAdapter,
    LitigesFakeAdapter,
    PortefeuilleFakeAdapter,
    LimiteurDebitService,
    ServiceSessions,
    ServiceSignatureExport,
    GererExports,
    ConsommerEvenements,
    ExportsProcessor,
    VersionSecuriteGuard,
    { provide: UTILISATEUR_REPOSITORY, useExisting: UtilisateurPrismaRepository },
    { provide: PROFIL_REPOSITORY, useExisting: ProfilPrismaRepository },
    { provide: ADRESSE_REPOSITORY, useExisting: AdressePrismaRepository },
    { provide: APPAREIL_REPOSITORY, useExisting: AppareilPrismaRepository },
    { provide: VERIFICATION_REPOSITORY, useExisting: VerificationPrismaRepository },
    {
      provide: REINITIALISATION_REPOSITORY,
      useExisting: ReinitialisationPrismaRepository,
    },
    { provide: INSCRIPTION_REPOSITORY, useExisting: InscriptionPrismaRepository },
    { provide: EXPORT_REPOSITORY, useExisting: ExportPrismaRepository },
    { provide: HACHEUR_MOT_DE_PASSE, useExisting: HacheurMotDePasseArgon2 },
    {
      provide: VERIFICATEUR_MOT_DE_PASSE_COMPROMIS,
      useExisting: VerificateurCompromisHibp,
    },
    { provide: NOTIFICATION_PORT, useExisting: NotificationOutboxAdapter },
    { provide: STOCKAGE_EXPORT, useExisting: StockageExportLocal },
    { provide: COMMANDES_PORT, useExisting: CommandesFakeAdapter },
    { provide: LITIGES_PORT, useExisting: LitigesFakeAdapter },
    { provide: PORTEFEUILLE_PORT, useExisting: PortefeuilleFakeAdapter },
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
    ...casUsage,
    ConsommerEvenements,
    GererExports,
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
