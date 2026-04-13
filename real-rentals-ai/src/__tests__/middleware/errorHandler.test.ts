import { Request, Response, NextFunction } from 'express';
import { errorHandler, AppError, asyncHandler } from '../../middleware/errorHandler';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

describe('Error Handler', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      path: '/test',
      method: 'GET',
      body: {},
      query: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('AppError', () => {
    it('should create AppError with status code', () => {
      const error = new AppError('Test error', 404);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(404);
      expect(error.isOperational).toBe(true);
    });
  });

  describe('errorHandler', () => {
    it('should handle ZodError', () => {
      // Crear un ZodError válido usando zod
      const { z } = require('zod');
      const schema = z.object({ email: z.string() });
      let zodError: ZodError | undefined;
      try {
        schema.parse({ email: 123 });
      } catch (error) {
        zodError = error as ZodError;
      }

      if (!zodError) {
        throw new Error('Failed to create ZodError');
      }

      errorHandler(
        zodError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Error de validación',
        })
      );
    });

    it('should handle AppError', () => {
      const appError = new AppError('Not found', 404);

      errorHandler(
        appError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Not found',
      });
    });

    it('should handle generic errors', () => {
      const genericError = new Error('Generic error');

      errorHandler(
        genericError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('asyncHandler', () => {
    it('should handle async function errors', async () => {
      const asyncFn = async () => {
        throw new Error('Async error');
      };

      const handler = asyncHandler(asyncFn);
      await handler(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should pass through successful async functions', async () => {
      const asyncFn = async (req: Request, res: Response) => {
        res.json({ success: true });
      };

      const handler = asyncHandler(asyncFn);
      await handler(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
    });
  });
});

