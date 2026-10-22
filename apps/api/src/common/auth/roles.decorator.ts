import { SetMetadata } from '@nestjs/common';
import type { Role } from './role';

export const ROLES_KEY = 'roles';

/** Rôles autorisés pour la route ou le contrôleur. */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
