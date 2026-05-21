/**
 * Utilidades de validación para formularios del frontend
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validador de email
 */
export function validateEmail(email: string): string | null {
  if (!email) {
    return 'El email es requerido';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'El email no es válido';
  }
  return null;
}

export type PasswordRequirementId = 'minLength' | 'uppercase' | 'lowercase' | 'number';

export interface PasswordRequirementStatus {
  id: PasswordRequirementId;
  met: boolean;
}

/** Requisitos de contraseña (misma lógica que el backend). */
export function getPasswordRequirements(password: string): PasswordRequirementStatus[] {
  return [
    { id: 'minLength', met: password.length >= 8 },
    { id: 'uppercase', met: /[A-Z]/.test(password) },
    { id: 'lowercase', met: /[a-z]/.test(password) },
    { id: 'number', met: /[0-9]/.test(password) },
  ];
}

export function isPasswordRequirementsMet(password: string): boolean {
  return getPasswordRequirements(password).every((r) => r.met);
}

/**
 * Validador de contraseña
 */
export function validatePassword(password: string): string | null {
  if (!password) {
    return 'La contraseña es requerida';
  }
  const requirements = getPasswordRequirements(password);
  const firstUnmet = requirements.find((r) => !r.met);
  if (!firstUnmet) return null;

  const messages: Record<PasswordRequirementId, string> = {
    minLength: 'La contraseña debe tener al menos 8 caracteres',
    uppercase: 'La contraseña debe contener al menos una mayúscula',
    lowercase: 'La contraseña debe contener al menos una minúscula',
    number: 'La contraseña debe contener al menos un número',
  };
  return messages[firstUnmet.id];
}

/**
 * Validador de nombre
 */
export function validateName(name: string): string | null {
  if (!name) {
    return 'El nombre es requerido';
  }
  if (name.length < 2) {
    return 'El nombre debe tener al menos 2 caracteres';
  }
  if (name.length > 100) {
    return 'El nombre no puede exceder 100 caracteres';
  }
  return null;
}

/**
 * Validador de precio
 */
export function validatePrice(price: string | number): string | null {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) {
    return 'El precio debe ser un número válido';
  }
  if (numPrice <= 0) {
    return 'El precio debe ser mayor a 0';
  }
  if (numPrice > 10000000) {
    return 'El precio no puede exceder 10,000,000';
  }
  return null;
}

/**
 * Validador de URL
 */
export function validateUrl(url: string): string | null {
  if (!url) {
    return null; // URL opcional
  }
  try {
    new URL(url);
    return null;
  } catch {
    return 'La URL no es válida';
  }
}

/**
 * Validador de múltiples URLs (separadas por comas)
 */
export function validateUrls(urls: string): string | null {
  if (!urls) {
    return null; // URLs opcionales
  }
  const urlArray = urls.split(',').map((u) => u.trim()).filter(Boolean);
  if (urlArray.length > 20) {
    return 'No se pueden agregar más de 20 imágenes';
  }
  for (const url of urlArray) {
    const error = validateUrl(url);
    if (error) {
      return `URL inválida: ${url}`;
    }
  }
  return null;
}

/**
 * Validador de formulario de registro
 */
export function validateRegisterForm(data: {
  name: string;
  email: string;
  password: string;
  role?: string;
}): ValidationResult {
  const errors: ValidationError[] = [];

  const nameError = validateName(data.name);
  if (nameError) errors.push({ field: 'name', message: nameError });

  const emailError = validateEmail(data.email);
  if (emailError) errors.push({ field: 'email', message: emailError });

  const passwordError = validatePassword(data.password);
  if (passwordError) errors.push({ field: 'password', message: passwordError });

  const allowedRoles = ['tenant', 'broker_applicant', 'owner', 'admin'];
  if (data.role && !allowedRoles.includes(data.role)) {
    errors.push({ field: 'role', message: 'Rol inválido' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validador de formulario de login
 */
export function validateLoginForm(data: {
  email: string;
  password: string;
}): ValidationResult {
  const errors: ValidationError[] = [];

  const emailError = validateEmail(data.email);
  if (emailError) errors.push({ field: 'email', message: emailError });

  if (!data.password) {
    errors.push({ field: 'password', message: 'La contraseña es requerida' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validador de formulario de propiedad
 * Requiere: al menos 8 fotos, foto del DNI del propietario, contrato o título de la propiedad.
 */
export function validatePropertyForm(data: {
  title: string;
  description?: string;
  price: string | number;
  location: string;
  images?: string;
  imageFiles?: File[];
  ownerDniDocument?: File | null;
  contractOrTitle?: File | null;
  videoTourFile?: File | null;
  rentalMonths?: number[];
  mapPin?: { lat: number; lng: number } | null;
  bedrooms?: string | number;
  rooms?: string | number;
  bathrooms?: string | number;
  area?: string | number;
}): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.title || data.title.trim().length < 3) {
    errors.push({ field: 'title', message: 'El título debe tener al menos 3 caracteres' });
  }
  if (data.title && data.title.length > 200) {
    errors.push({ field: 'title', message: 'El título no puede exceder 200 caracteres' });
  }

  if (data.description && data.description.length > 5000) {
    errors.push({ field: 'description', message: 'La descripción no puede exceder 5000 caracteres' });
  }

  const priceError = validatePrice(data.price);
  if (priceError) errors.push({ field: 'price', message: priceError });

  if (!data.location || data.location.trim().length < 3) {
    errors.push({ field: 'location', message: 'La ubicación debe tener al menos 3 caracteres' });
  }
  if (data.location && data.location.length > 200) {
    errors.push({ field: 'location', message: 'La ubicación no puede exceder 200 caracteres' });
  }

  // Mínimo 8 fotos: desde URLs o desde archivos subidos
  const urlCount = data.images ? data.images.split(',').map((u) => u.trim()).filter(Boolean).length : 0;
  const fileCount = data.imageFiles?.length ?? 0;
  const totalImages = fileCount > 0 ? fileCount : urlCount;
  if (totalImages < 8) {
    errors.push({ field: 'images', message: 'Debes subir al menos 8 fotos de la propiedad' });
  }
  if (data.images && fileCount === 0) {
    const urlsError = validateUrls(data.images);
    if (urlsError) errors.push({ field: 'images', message: urlsError });
  }

  if (!data.ownerDniDocument) {
    errors.push({ field: 'ownerDniDocument', message: 'Debes subir una foto de tu DNI (documento de identidad)' });
  }

  if (!data.contractOrTitle) {
    errors.push({ field: 'contractOrTitle', message: 'Debes subir el contrato o título de la propiedad' });
  }

  if (!data.videoTourFile) {
    errors.push({ field: 'videoTourFile', message: 'Debes subir un video tour de la propiedad' });
  }

  const months = data.rentalMonths ?? [];
  const validMonths = months.filter((m) => [3, 6, 12].includes(m));
  if (validMonths.length === 0) {
    errors.push({
      field: 'rentalMonths',
      message: 'Debes indicar al menos una opción de alquiler: 3, 6 o 12 meses',
    });
  }

  if (!data.mapPin || typeof data.mapPin.lat !== 'number' || typeof data.mapPin.lng !== 'number') {
    errors.push({
      field: 'mapPin',
      message: 'Debes marcar la ubicación exacta de la propiedad en el mapa',
    });
  }

  if (data.bedrooms !== undefined) {
    const bedrooms = typeof data.bedrooms === 'string' ? parseInt(data.bedrooms, 10) : data.bedrooms;
    if (isNaN(bedrooms) || bedrooms < 0 || bedrooms > 50) {
      errors.push({ field: 'bedrooms', message: 'Las habitaciones deben ser un número entre 0 y 50' });
    }
  }

  if (data.rooms !== undefined && data.rooms !== '') {
    const rooms = typeof data.rooms === 'string' ? parseInt(data.rooms, 10) : data.rooms;
    if (isNaN(rooms) || rooms < 0 || rooms > 50) {
      errors.push({ field: 'rooms', message: 'Los ambientes deben ser un número entre 0 y 50' });
    }
  }

  if (data.bathrooms !== undefined && data.bathrooms !== '') {
    const bathrooms = typeof data.bathrooms === 'string' ? parseInt(data.bathrooms, 10) : data.bathrooms;
    if (isNaN(bathrooms) || bathrooms < 0 || bathrooms > 50) {
      errors.push({ field: 'bathrooms', message: 'Los baños deben ser un número entre 0 y 50' });
    }
  }

  if (data.area !== undefined) {
    const area = typeof data.area === 'string' ? parseFloat(data.area) : data.area;
    if (isNaN(area) || area <= 0 || area > 100000) {
      errors.push({ field: 'area', message: 'El área debe ser un número entre 0 y 100,000 m²' });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Obtener el primer error de un campo específico
 */
export function getFieldError(errors: ValidationError[], field: string): string | null {
  const error = errors.find((e) => e.field === field);
  return error ? error.message : null;
}

