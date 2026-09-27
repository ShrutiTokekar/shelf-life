import type { Auth, SessionUser } from './auth';
import type { Db } from './db/client';

export type AppEnv = {
  Variables: {
    db: Db;
    auth: Auth;
    user: SessionUser;
  };
};
