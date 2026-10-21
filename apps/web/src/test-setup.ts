import { cleanup } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
