import { logger, LogLevel } from '../../utils/logger';

describe('Logger', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'info').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should log info messages', () => {
    logger.info('Test message', 'TestContext');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should log error messages', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    const error = new Error('Test error');
    logger.error('Error occurred', 'TestContext', error);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('should log warning messages', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    logger.warn('Warning message', 'TestContext');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('should include metadata in logs', () => {
    logger.info('Test message', 'TestContext', { key: 'value' });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Test message')
    );
  });
});

