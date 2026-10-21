import { dependencies } from './container.js';
import { createApp } from './interface/http/app.js';

export const app = createApp(dependencies);
