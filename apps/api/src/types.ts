import type { Auth, SessionRecord, SessionUser } from './auth';
import type { Db } from './db/client';

export type AppEnv = {
  Variables: {
    db: Db;
    auth: Auth;
    user: SessionUser;
    session: SessionRecord;
    /** The clock (swapped in tests). */
    now: () => Date;
  };
};
