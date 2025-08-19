// Jest setup file
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.development', override: false });

// Mock console methods to reduce noise in tests
global.console = {
    ...console,
    // Uncomment to ignore specific console methods during tests
    // log: jest.fn(),
    // warn: jest.fn(),
    // error: jest.fn(),
};

// Set test timeout
jest.setTimeout(30000);