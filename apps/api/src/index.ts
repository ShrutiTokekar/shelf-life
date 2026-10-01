import { loadEnv } from './env';
import { startApi } from './server';

await startApi(loadEnv());
