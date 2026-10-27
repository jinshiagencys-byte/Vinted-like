import { describe, expect, it } from 'vitest';
import { normaliserPourModeration, ModerationTexteAdapter } from '../moderation-texte.adapter';

describe('ModerationTexteAdapter', () => {
  const moderation = new ModerationTexteAdapter();

  it('normalise casse, accents et leetspeak', () => {
    expect(normaliserPourModeration('Wh4tsApp ÉCRIRE')).toBe('whatsapp ecrire');
  });

  it('détecte un mot interdit malgré les substitutions', async () => {
    await expect(moderation.analyser('Contacte-moi sur wh4ts4pp')).resolves.toEqual({
      contientContact: false,
      motsInterdits: ['whatsapp'],
    });
  });

  it('détecte une adresse e-mail ou un téléphone', async () => {
    const analyse = await moderation.analyser('Écrivez à vendeur@example.com');
    expect(analyse.contientContact).toBe(true);
    expect(analyse.motsInterdits).toEqual([]);
  });

  it('laisse passer un texte conforme', async () => {
    await expect(
      moderation.analyser('Jean porté deux fois, aucune tache, envoi rapide.'),
    ).resolves.toEqual({ contientContact: false, motsInterdits: [] });
  });
});
