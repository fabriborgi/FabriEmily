import { config } from 'dotenv';
import { beforeAll } from 'vitest';
import { serviceClient, COUPLE_EMAIL, COUPLE_PASSWORD } from './helpers';

config({ path: '.env.test' });

/** L'utente della coppia si crea a mano in produzione; nei test lo creiamo qui. */
beforeAll(async () => {
  const admin = serviceClient();
  const { error } = await admin.auth.admin.createUser({
    email: COUPLE_EMAIL,
    password: COUPLE_PASSWORD,
    email_confirm: true,
  });
  if (error && !/already/i.test(error.message)) throw error;
});
