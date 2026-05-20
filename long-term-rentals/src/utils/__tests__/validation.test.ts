import { describe, it, expect } from 'vitest'
import {
  validateEmail,
  validatePassword,
  validateName,
  validatePrice,
  validateUrl,
  validateUrls,
  validateRegisterForm,
  validateLoginForm,
  validatePropertyForm,
} from '../validation'

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    it('should return null for valid email', () => {
      expect(validateEmail('test@example.com')).toBeNull()
    })

    it('should return error for invalid email', () => {
      expect(validateEmail('invalid-email')).not.toBeNull()
    })

    it('should return error for empty email', () => {
      expect(validateEmail('')).not.toBeNull()
    })
  })

  describe('validatePassword', () => {
    it('should return null for valid password', () => {
      expect(validatePassword('Password123')).toBeNull()
    })

    it('should return error for short password', () => {
      expect(validatePassword('Short1')).not.toBeNull()
    })

    it('should return error for password without uppercase', () => {
      expect(validatePassword('password123')).not.toBeNull()
    })

    it('should return error for password without number', () => {
      expect(validatePassword('Password')).not.toBeNull()
    })
  })

  describe('validateName', () => {
    it('should return null for valid name', () => {
      expect(validateName('John Doe')).toBeNull()
    })

    it('should return error for short name', () => {
      expect(validateName('J')).not.toBeNull()
    })

    it('should return error for empty name', () => {
      expect(validateName('')).not.toBeNull()
    })
  })

  describe('validatePrice', () => {
    it('should return null for valid price', () => {
      expect(validatePrice(1000)).toBeNull()
      expect(validatePrice('1000')).toBeNull()
    })

    it('should return error for negative price', () => {
      expect(validatePrice(-100)).not.toBeNull()
    })

    it('should return error for invalid price', () => {
      expect(validatePrice('invalid')).not.toBeNull()
    })
  })

  describe('validateUrl', () => {
    it('should return null for valid URL', () => {
      expect(validateUrl('https://example.com')).toBeNull()
    })

    it('should return error for invalid URL', () => {
      expect(validateUrl('not-a-url')).not.toBeNull()
    })

    it('should return null for empty URL (optional)', () => {
      expect(validateUrl('')).toBeNull()
    })
  })

  describe('validateRegisterForm', () => {
    it('should validate correct registration form', () => {
      const result = validateRegisterForm({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
      })
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should return errors for invalid form', () => {
      const result = validateRegisterForm({
        name: 'J',
        email: 'invalid',
        password: 'short',
      })
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('validateLoginForm', () => {
    it('should validate correct login form', () => {
      const result = validateLoginForm({
        email: 'john@example.com',
        password: 'anypassword',
      })
      expect(result.isValid).toBe(true)
    })

    it('should return errors for invalid form', () => {
      const result = validateLoginForm({
        email: 'invalid',
        password: '',
      })
      expect(result.isValid).toBe(false)
    })
  })

  describe('validatePropertyForm', () => {
    it('should validate correct property form', () => {
      const result = validatePropertyForm({
        title: 'Beautiful Apartment',
        description: 'Nice place',
        price: 1000,
        location: 'Miami, FL',
        images: 'https://a.com/1.jpg,https://a.com/2.jpg,https://a.com/3.jpg,https://a.com/4.jpg,https://a.com/5.jpg,https://a.com/6.jpg,https://a.com/7.jpg,https://a.com/8.jpg',
        ownerDniDocument: new File(['dni'], 'dni.png', { type: 'image/png' }),
        contractOrTitle: new File(['contract'], 'contract.pdf', { type: 'application/pdf' }),
        videoTourFile: new File(['video'], 'tour.mp4', { type: 'video/mp4' }),
      })
      expect(result.isValid).toBe(true)
    })

    it('should return errors for invalid form', () => {
      const result = validatePropertyForm({
        title: 'AB',
        price: -100,
        location: 'AB',
      })
      expect(result.isValid).toBe(false)
    })
  })
})

