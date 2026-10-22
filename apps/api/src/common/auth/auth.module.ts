import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EmailVerifieGuard } from './email-verifie.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ProprietaireGuard } from './proprietaire.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          issuer: config.getOrThrow<string>('JWT_ISSUER'),
          audience: config.getOrThrow<string>('JWT_AUDIENCE'),
          expiresIn: '15m',
          algorithm: 'HS256',
          header: {
            alg: 'HS256',
            kid: config.getOrThrow<string>('JWT_KID'),
          },
        },
        verifyOptions: {
          issuer: config.getOrThrow<string>('JWT_ISSUER'),
          audience: config.getOrThrow<string>('JWT_AUDIENCE'),
          algorithms: ['HS256'],
        },
      }),
    }),
  ],
  providers: [JwtAuthGuard, RolesGuard, ProprietaireGuard, EmailVerifieGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard, ProprietaireGuard, EmailVerifieGuard],
})
export class AuthModule {}
