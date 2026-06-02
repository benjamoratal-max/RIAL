/**
 * Datos simulados que devuelve el backend falso en los tests E2E.
 * Modelan los contratos reales de la API (PropertySummary, login, etc.).
 */

export function makeProperty(overrides: Partial<any> = {}) {
  const id = overrides.id ?? 1
  return {
    id,
    ownerId: 10,
    title: `Skyline Residence ${id}`,
    subtitle: 'Departamento premium con vista panorámica',
    description: 'Hermoso departamento en el corazón de Brickell.',
    price: 3200,
    salePrice: 850000,
    currency: 'USD',
    location: 'Brickell, Miami, FL',
    city: 'Miami',
    country: 'USA',
    neighborhood: 'Brickell',
    type: 'Departamento de lujo',
    bedrooms: 3,
    bathrooms: 2,
    rooms: 4,
    area: 120,
    yearBuilt: 2020,
    deposit: 3200,
    hoa: 400,
    latitude: 25.7617,
    longitude: -80.1918,
    rentalMonths: '3,6,12',
    videoTourUrl: 'https://example.com/tour.mp4',
    availableFor: ['rent', 'buy'],
    amenities: ['WiFi', 'Pileta'],
    buildingAmenities: ['Gimnasio'],
    safety: ['Cámaras 24h'],
    highlights: ['Vista al mar'],
    images: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688',
      'https://images.unsplash.com/photo-1502672023488-70e25813eb80',
    ],
    broker: {
      name: 'Broker Demo',
      brokerageName: 'RIAL Realty',
      licenseState: 'FL',
      licenseType: 'Sales Associate',
      licenseExpiration: '2030-01-01T00:00:00.000Z',
      verificationStatus: 'approved',
      isVerifiedBroker: true,
    },
    ...overrides,
  }
}

export function makeSummaryItem(overrides: Partial<any> = {}) {
  const property = makeProperty(overrides.property ?? {})
  return {
    property,
    isAvailable: overrides.isAvailable ?? true,
    averageRating: overrides.averageRating ?? 4.6,
    reviewsCount: overrides.reviewsCount ?? 12,
    ...overrides,
  }
}

export const propertiesList = [
  makeSummaryItem({ property: makeProperty({ id: 1, title: 'Skyline Residence' }) }),
  makeSummaryItem({ property: makeProperty({ id: 2, title: 'Bay Loft Moderno', price: 2400, bedrooms: 2 }) }),
  makeSummaryItem({ property: makeProperty({ id: 3, title: 'Casa Coral Gables', price: 5200, type: 'Casa', bedrooms: 4 }) }),
]

export function makeUser(overrides: Partial<any> = {}) {
  return {
    id: 100,
    name: 'Test Usuario',
    email: 'test@rial.app',
    role: 'tenant',
    verified: true,
    emailVerified: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    joinDate: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export const FAKE_TOKEN = 'fake.jwt.token'

export function summaryResponseFor(id: number) {
  const item = propertiesList.find((p) => p.property.id === id) ?? makeSummaryItem({ property: makeProperty({ id }) })
  return {
    property: item.property,
    isAvailable: item.isAvailable,
    averageRating: item.averageRating,
    reviewsCount: item.reviewsCount,
    latestReviews: [
      { id: 1, rating: 5, comment: 'Excelente lugar', user: { id: 1, name: 'Ana' } },
    ],
  }
}
