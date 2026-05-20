import { parsePropertySearchQuery } from '../utils/searchQueryParser'

type TransactionMode = 'rent' | 'buy'

export interface PropertyReview {
  id: number
  user: {
    name: string
    role?: string
    avatar?: string
  }
  rating: number
  comment: string
  date: string
}

export interface PropertyData {
  id: number
  title: string
  subtitle: string
  description: string
  descriptionEn?: string
  price: number
  salePrice?: number
  currency: string
  location: string
  city: string
  country: string
  neighborhood: string
  type: string
  bedrooms: number
  bathrooms: number
  beds: number
  rooms: number
  parking: number
  area: number
  yearBuilt: number
  verified: boolean
  availableFor: TransactionMode[]
  availableNow: boolean
  deposit: number
  hoa?: number
  tax?: number
  amenities: string[]
  buildingAmenities: string[]
  safety: string[]
  highlights: string[]
  latitude: number
  longitude: number
  images: string[]
  /** URL del video tour (subido por propietario o generado con IA) */
  videoTour?: string
}

export interface PropertySummary {
  property: PropertyData
  averageRating: number
  reviewsCount: number
  latestReviews: PropertyReview[]
  isAvailable: boolean
}

const basePropertySummaries: PropertySummary[] = [
  {
    property: {
      id: 1,
      title: 'Skyline Residence · Terraza privada',
      subtitle: 'Departamento premium con vista panorámica 270°',
      description: 'Ubicada en el corazón de Brickell, esta residencia ofrece ventanales piso-techo, domótica completa, cocina gourmet con isla de mármol y terraza con vistas a la bahía. El edificio cuenta con certificación LEED y concierge 24/7.',
      descriptionEn: 'Located in the heart of Brickell, this residence offers floor-to-ceiling windows, full smart home automation, a gourmet kitchen with marble island and a terrace with bay views. The building has LEED certification and 24/7 concierge.',
      price: 3200,
      salePrice: 850000,
      currency: 'USD',
      location: 'Brickell, Miami, FL',
      city: 'Miami',
      country: 'USA',
      neighborhood: 'Brickell',
      type: 'Departamento de lujo',
      bedrooms: 3,
      bathrooms: 3,
      beds: 4,
      rooms: 5,
      parking: 2,
      area: 210,
      yearBuilt: 2022,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 6400,
      hoa: 650,
      amenities: ['Cocina gourmet', 'Terraza privada', 'Lavadero', 'Office con vidrio inteligente', 'Piso radiante', 'Sistema de sonido Sonos'],
      buildingAmenities: ['Rooftop con piscina climatizada', 'Cowork 24/7', 'Gimnasio Technogym', 'Sala de cine', 'Pet spa'],
      safety: ['Ingreso biométrico', 'Vigilancia 24/7', 'Ascensores con clave', 'Sistema anti incendios', 'Generador propio'],
      highlights: ['Domótica completa', 'Vista al Río de la Plata', 'Terraza verde', 'Concierge 24/7', 'Cochera doble'],
      latitude: -34.6075,
      longitude: -58.3622,
      images: [
        'https://images.unsplash.com/photo-1505692794400-0d9dc3497216?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.9,
    reviewsCount: 34,
    latestReviews: [
      { id: 11, user: { name: 'Valentina R.' }, rating: 5, comment: 'Increíble vista y amenities nivel hotel cinco estrellas.', date: '2025-02-12' },
      { id: 12, user: { name: 'Javier M.' }, rating: 5, comment: 'La domótica y el concierge hicieron todo muy fácil.', date: '2025-01-30' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 2,
      title: 'Costa Verde Loft',
      subtitle: 'Loft bioclimático frente al mar',
      description: 'Loft de doble altura con balcones corridos y acabados en madera natural. Incluye estación de trabajo acústica, domótica por voz, cocina integrada y acceso directo al malecón de Miraflores.',
      descriptionEn: 'Double-height loft with running balconies and natural wood finishes. Includes acoustic work station, voice-controlled smart home, integrated kitchen and direct access to the Miraflores boardwalk.',
      price: 1800,
      salePrice: 520000,
      currency: 'USD',
      location: 'Malecón Cisneros, Lima',
      city: 'Lima',
      country: 'Perú',
      neighborhood: 'Miraflores',
      type: 'Loft',
      bedrooms: 2,
      bathrooms: 2,
      beds: 3,
      rooms: 4,
      parking: 1,
      area: 140,
      yearBuilt: 2020,
      verified: true,
      availableFor: ['rent'],
      availableNow: true,
      deposit: 3600,
      hoa: 320,
      amenities: ['Paneles acústicos', 'Estación de trabajo', 'Balcón corrido', 'Lavadora-secadora', 'Persianas eléctricas'],
      buildingAmenities: ['Piscina con vista al mar', 'Yoga studio', 'Cowork café', 'Lockers inteligentes', 'Bicicletero'],
      safety: ['Guardia 24h', 'App de acceso', 'Sensores de humo', 'Sistema CCTV AI'],
      highlights: ['Vista al océano', 'Loft de doble altura', 'Espacio ideal para creadores', 'Pet friendly'],
      latitude: -12.1218,
      longitude: -77.0283,
      images: [
        'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.8,
    reviewsCount: 21,
    latestReviews: [
      { id: 21, user: { name: 'Gabriela S.' }, rating: 5, comment: 'El cowork del edificio es perfecto para trabajar remoto.', date: '2025-02-04' },
      { id: 22, user: { name: 'Rodrigo P.' }, rating: 4, comment: 'Excelente ubicación, tráfico mínimo.', date: '2025-01-18' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 3,
      title: 'Andean Retreat',
      subtitle: 'Apartamento con jardín vertical y sauna privado',
      description: 'Espacio cálido con madera natural, chimenea ecológica y jardín vertical interior. Incluye sauna seco privado y mirador con vista a Medellín.',
      descriptionEn: 'Warm space with natural wood, eco fireplace and indoor vertical garden. Includes private dry sauna and viewpoint overlooking Medellín.',
      price: 2200,
      salePrice: 610000,
      currency: 'USD',
      location: 'El Poblado, Medellín',
      city: 'Medellín',
      country: 'Colombia',
      neighborhood: 'Astorga',
      type: 'Apartamento',
      bedrooms: 3,
      bathrooms: 3,
      beds: 4,
      rooms: 5,
      parking: 2,
      area: 185,
      yearBuilt: 2021,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: false,
      deposit: 4400,
      hoa: 410,
      amenities: ['Sauna seco privado', 'Jardín vertical', 'Chimenea ecológica', 'Cuarto de servicio', 'Despensa'],
      buildingAmenities: ['Piscina semiolímpica', 'Cancha de squash', 'Kids club', 'Salón inglés', 'Zona BBQ gourmet'],
      safety: ['Portería blindada', 'Control de accesos por QR', 'Red contra incendios', 'Monitoreo remoto'],
      highlights: ['Vistas a la ciudad', 'Acabados en roble', 'Tres balcones', 'Pet spa en el edificio'],
      latitude: 6.2067,
      longitude: -75.5658,
      images: [
        'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1481277542470-605612bd2d61?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.7,
    reviewsCount: 18,
    latestReviews: [
      { id: 31, user: { name: 'Mariana L.' }, rating: 5, comment: 'El sauna privado es un diferencial total.', date: '2025-02-01' },
      { id: 32, user: { name: 'Esteban A.' }, rating: 4, comment: 'Zona súper segura y silenciosa.', date: '2025-01-08' }
    ],
    isAvailable: false
  },
  {
    property: {
      id: 4,
      title: 'Pacific Pearl Penthouse',
      subtitle: 'Penthouse dúplex con pileta climatizada',
      description: 'Penthouse de dos niveles en Reñaca con pileta climatizada, terraza envolvente, parrilla completa y estudio independiente. Ideal para combinar home office y estilo de vida playero.',
      descriptionEn: 'Two-level penthouse in Reñaca with heated pool, wrap-around terrace, full grill and independent studio. Ideal for combining home office and beach lifestyle.',
      price: 2600,
      salePrice: 690000,
      currency: 'USD',
      location: 'Reñaca, Viña del Mar',
      city: 'Viña del Mar',
      country: 'Chile',
      neighborhood: 'Costa Brava',
      type: 'Penthouse',
      bedrooms: 3,
      bathrooms: 3,
      beds: 4,
      rooms: 5,
      parking: 2,
      area: 200,
      yearBuilt: 2019,
      verified: true,
      availableFor: ['rent'],
      availableNow: true,
      deposit: 5200,
      hoa: 370,
      amenities: ['Pileta privada', 'Parrilla techada', 'Doble living', 'Home office vidriado', 'Lavadero independiente'],
      buildingAmenities: ['Piscinas exteriores', 'Gimnasio', 'Kids club', 'Salas de reuniones', 'Jardines con sendero'],
      safety: ['Guardia motorizada', 'Cámaras perimetrales', 'Sensores de movimiento', 'Ingreso con código'],
      highlights: ['Doble altura', 'Terraza envolvente', 'Vistas al Pacífico', 'Amplio storage'],
      latitude: -32.9704,
      longitude: -71.5518,
      images: [
        'https://images.unsplash.com/photo-1501183638710-841dd1904471?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1464146072230-91cabc968266?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1488722796624-0aa6f1bb6399?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.9,
    reviewsCount: 26,
    latestReviews: [
      { id: 41, user: { name: 'Constanza V.' }, rating: 5, comment: 'La terraza es un sueño para reuniones familiares.', date: '2025-02-10' },
      { id: 42, user: { name: 'Felipe H.' }, rating: 5, comment: 'Perfecto para home office con vista al mar.', date: '2025-01-05' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 5,
      title: 'Little Havana Smart Flat',
      subtitle: 'Apartamento inteligente con patio',
      description: 'Un apartamento de dos habitaciones con patio privado, luz natural todo el día y sensores inteligentes que automatizan iluminación y climatización. Ideal para nómadas digitales.',
      price: 980,
      salePrice: 260000,
      currency: 'USD',
      location: 'Little Havana, Miami, FL',
      city: 'Miami',
      country: 'USA',
      neighborhood: 'Little Havana',
      type: 'Departamento',
      bedrooms: 1,
      bathrooms: 1,
      beds: 1,
      rooms: 2,
      parking: 1,
      area: 78,
      yearBuilt: 2018,
      verified: true,
      availableFor: ['rent'],
      availableNow: true,
      deposit: 1960,
      hoa: 180,
      amenities: ['Patio interno', 'Kitchenette premium', 'Climatización inteligente', 'Cerradura digital'],
      buildingAmenities: ['Cowork panorámico', 'Sum con parrilla', 'Laundry con app', 'Lockers inteligentes'],
      safety: ['Ingreso facial', 'Sensores de CO2', 'Circuito cerrado'],
      highlights: ['Patio estilo andaluz', 'A pasos del parque Sarmiento', 'WiFi 1Gb simétrico'],
      latitude: -31.4237,
      longitude: -64.1868,
      images: [
        'https://images.unsplash.com/photo-1486304873000-235643847519?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.6,
    reviewsCount: 14,
    latestReviews: [
      { id: 51, user: { name: 'Tomas I.' }, rating: 5, comment: 'Automatización impecable, casi no usé interruptores.', date: '2025-01-15' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 6,
      title: 'Riviera Family Condo',
      subtitle: 'Condominio familiar sobre la Rambla',
      description: 'Departamento de tres dormitorios con vistas abiertas al océano. Incluye área de juegos privada, family room, doble circulación de aire y cocina integrada con barra familiar.',
      price: 2100,
      salePrice: 580000,
      currency: 'USD',
      location: 'Punta Carretas, Montevideo',
      city: 'Montevideo',
      country: 'Uruguay',
      neighborhood: 'Rambla Gandhi',
      type: 'Condominio',
      bedrooms: 3,
      bathrooms: 3,
      beds: 4,
      rooms: 5,
      parking: 2,
      area: 165,
      yearBuilt: 2017,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 4200,
      hoa: 340,
      amenities: ['Family room cerrado', 'Balcón corrido', 'Lavadero con patio', 'Domótica parcial'],
      buildingAmenities: ['Piscina climatizada', 'Kids club', 'Gimnasio', 'Terrazas verdes', 'Guardería'],
      safety: ['Vigilancia 24/7', 'Timbres inteligentes', 'Ascensores con código'],
      highlights: ['Vistas despejadas', 'Ideal familias', 'Club infantil privado'],
      latitude: -34.9239,
      longitude: -56.1644,
      images: [
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.8,
    reviewsCount: 19,
    latestReviews: [
      { id: 61, user: { name: 'Virginia C.' }, rating: 5, comment: 'Espacio perfecto para la familia, kids club increíble.', date: '2025-02-06' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 7,
      title: 'Montevideo Executive Suite',
      subtitle: 'Suite ejecutiva con sala de reuniones privada',
      description: 'Departamento pensado para ejecutivos: living flexible, sala de reuniones insonorizada y kitchenette oculta. Incluye servicio de housekeeping y chofer bajo demanda.',
      price: 2450,
      salePrice: 610000,
      currency: 'USD',
      location: 'Centro Financiero, Montevideo',
      city: 'Montevideo',
      country: 'Uruguay',
      neighborhood: 'World Trade Center',
      type: 'Suite',
      bedrooms: 2,
      bathrooms: 2,
      beds: 2,
      rooms: 3,
      parking: 1,
      area: 120,
      yearBuilt: 2023,
      verified: true,
      availableFor: ['rent'],
      availableNow: true,
      deposit: 4900,
      hoa: 420,
      amenities: ['Sala de reuniones', 'Cortinas motorizadas', 'Kitchenette oculta', 'Servicio housekeeping'],
      buildingAmenities: ['Business center 24/7', 'Helipuerto cercano', 'Terraza ejecutiva', 'Gimnasio premium'],
      safety: ['Control facial', 'Guardia corporativa', 'Búnker de datos'],
      highlights: ['Servicio de chofer', 'Contrato corporativo flexible'],
      latitude: -34.9064,
      longitude: -56.1426,
      images: [
        'https://images.unsplash.com/photo-1505692794400-0d9dc3497216?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.9,
    reviewsCount: 11,
    latestReviews: [
      { id: 71, user: { name: 'Marcelo F.' }, rating: 5, comment: 'La sala de reuniones privada me salvó muchas veces.', date: '2025-02-08' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 8,
      title: 'Santiago Tech Hub Residences',
      subtitle: 'Residencia full amenities junto a Parque Araucano',
      description: 'Departamento moderno con cocina en U, balcón con parrilla y clósets modulares. El edificio cuenta con living gamer, simulador de golf y talleres de innovación.',
      price: 1950,
      salePrice: 540000,
      currency: 'USD',
      location: 'Las Condes, Santiago',
      city: 'Santiago',
      country: 'Chile',
      neighborhood: 'Parque Araucano',
      type: 'Departamento',
      bedrooms: 2,
      bathrooms: 2,
      beds: 2,
      rooms: 3,
      parking: 1,
      area: 110,
      yearBuilt: 2022,
      verified: true,
      availableFor: ['rent'],
      availableNow: true,
      deposit: 3900,
      hoa: 290,
      amenities: ['Parrilla en balcón', 'Cocina en U', 'Clósets modulares', 'Estación de carga EV'],
      buildingAmenities: ['Living gamer', 'Simulador de golf', 'Maker space', 'Cowork de 3 niveles', 'Piscina panorámica'],
      safety: ['Recepción 24h', 'Ingreso por QR', 'Sensores de inundación'],
      highlights: ['Programas de innovación', 'Full amenities tech', 'Ideal para founders'],
      latitude: -33.4058,
      longitude: -70.5719,
      images: [
        'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1481277542470-605612bd2d61?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.7,
    reviewsCount: 15,
    latestReviews: [
      { id: 81, user: { name: 'Anaïs V.' }, rating: 5, comment: 'El maker space del edificio es único.', date: '2025-02-03' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 9,
      title: 'Cancún Marina Penthouse',
      subtitle: 'Penthouse tropical con marina privada',
      description: 'Residencia de tres dormitorios con jacuzzi exterior, muelle privado y chef service opcional. El condominio incluye club náutico y scooters eléctricos.',
      price: 3500,
      salePrice: 920000,
      currency: 'USD',
      location: 'Zona Hotelera, Cancún',
      city: 'Cancún',
      country: 'México',
      neighborhood: 'Laguna Nichupté',
      type: 'Penthouse',
      bedrooms: 3,
      bathrooms: 3,
      beds: 4,
      rooms: 5,
      parking: 2,
      area: 230,
      yearBuilt: 2021,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 7000,
      hoa: 520,
      amenities: ['Jacuzzi exterior', 'Muelle privado', 'Cocina profesional', 'Chef service', 'Oficina abierta'],
      buildingAmenities: ['Club náutico', 'Scooters eléctricos', 'Infinity pool', 'Beach club privado', 'Spa'],
      safety: ['Seguridad armada', 'Control vehicular', 'Monitoreo náutico'],
      highlights: ['Acceso a marina', 'Servicio hotelero', 'Ideal para eventos privados'],
      latitude: 21.1225,
      longitude: -86.7556,
      images: [
        'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 5,
    reviewsCount: 12,
    latestReviews: [
      { id: 91, user: { name: 'Lucía G.' }, rating: 5, comment: 'El muelle privado hizo toda la diferencia.', date: '2025-02-11' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 10,
      title: 'Barcelona Gothic Loft',
      subtitle: 'Loft restaurado con historia y diseño',
      description: 'Situado en un edificio del siglo XIX, combina vigas vistas originales con acabados contemporáneos. Incluye estudio insonorizado y terraza interior con naranjos.',
      price: 2400,
      salePrice: 640000,
      currency: 'EUR',
      location: 'Barrio Gótico, Barcelona',
      city: 'Barcelona',
      country: 'España',
      neighborhood: 'Plaça Reial',
      type: 'Loft patrimonial',
      bedrooms: 2,
      bathrooms: 2,
      beds: 2,
      rooms: 3,
      parking: 0,
      area: 130,
      yearBuilt: 1890,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 4800,
      hoa: 250,
      amenities: ['Estudio insonorizado', 'Terraza interior', 'Calefacción radiante', 'Domótica oculta'],
      buildingAmenities: ['Azotea comunitaria', 'Taller de arte', 'Guardabicis', 'Wine room compartida'],
      safety: ['Puerta blindada', 'Videovigilancia', 'Control de humedad'],
      highlights: ['Edificio patrimonial', 'Restauración reciente', 'Espacios flexibles'],
      latitude: 41.3809,
      longitude: 2.1763,
      images: [
        'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.8,
    reviewsCount: 17,
    latestReviews: [
      { id: 101, user: { name: 'Elena D.' }, rating: 5, comment: 'Cada detalle mantiene la historia del lugar.', date: '2025-02-05' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 11,
      title: 'Lisboa Riverfront Atelier',
      subtitle: 'Atelier minimalista con taller creativo',
      description: 'Departamento inspirado en estudios de arte con ventanales industriales, taller creativo insonorizado y mezzanine para huéspedes. Incluye almacenamiento oculto y mobiliario modular.',
      price: 1850,
      salePrice: 490000,
      currency: 'EUR',
      location: 'Cais do Sodré, Lisboa',
      city: 'Lisboa',
      country: 'Portugal',
      neighborhood: 'Cais',
      type: 'Atelier',
      bedrooms: 2,
      bathrooms: 2,
      beds: 2,
      rooms: 3,
      parking: 1,
      area: 115,
      yearBuilt: 2018,
      verified: true,
      availableFor: ['rent'],
      availableNow: true,
      deposit: 3700,
      hoa: 210,
      amenities: ['Taller creativo', 'Mezzanine para huéspedes', 'Domótica por voz', 'Cortinas blackout'],
      buildingAmenities: ['Galería en planta baja', 'Cowork artístico', 'Terraza con huertos', 'Parking de bicis eléctricas'],
      safety: ['Acceso RFID', 'Cámaras 4K', 'Sensores acústicos'],
      highlights: ['Perfecto para creativos', 'Ribera del Tajo', 'Programas culturales'],
      latitude: 38.7079,
      longitude: -9.1487,
      images: [
        'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.7,
    reviewsCount: 9,
    latestReviews: [
      { id: 111, user: { name: 'Enzo R.' }, rating: 5, comment: 'La luz natural es perfecta para pintar.', date: '2025-01-12' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 12,
      title: 'Madrid Skyline Duplex',
      subtitle: 'Dúplex inteligente en Paseo de la Castellana',
      description: 'Dúplex con doble living, home office acristalado y terraza volada. Integra sistema KNX, cerramientos acústicos y área de fitness privada.',
      price: 3100,
      salePrice: 760000,
      currency: 'EUR',
      location: 'Paseo de la Castellana, Madrid',
      city: 'Madrid',
      country: 'España',
      neighborhood: 'Chamartín',
      type: 'Dúplex',
      bedrooms: 3,
      bathrooms: 3,
      beds: 4,
      rooms: 5,
      parking: 2,
      area: 205,
      yearBuilt: 2021,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 6200,
      hoa: 420,
      amenities: ['Home office acristalado', 'Gimnasio privado', 'Terraza volada', 'Cocina Bulthaup'],
      buildingAmenities: ['Piscina cubierta', 'Sauna seca', 'Social club', 'Puestos de carga EV'],
      safety: ['Control facial', 'Sensores perimetrales', 'Red anti incendios inteligente'],
      highlights: ['Vistas a Castellana', 'Tecnología KNX', 'Espacios flexibles'],
      latitude: 40.4531,
      longitude: -3.6894,
      images: [
        'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.9,
    reviewsCount: 22,
    latestReviews: [
      { id: 121, user: { name: 'Sergio Á.' }, rating: 5, comment: 'Automatización impecable y espacios bien pensados.', date: '2025-02-09' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 13,
      title: 'Bogotá Botanical Loft',
      subtitle: 'Loft tropical con invernadero interior',
      description: 'Loft con jardín botánico integrado, doble altura y cocina laboratorio. Incluye cuarto de meditación, cine inmersivo y paneles solares.',
      price: 2300,
      salePrice: 640000,
      currency: 'USD',
      location: 'Zona G, Bogotá',
      city: 'Bogotá',
      country: 'Colombia',
      neighborhood: 'Chapinero Alto',
      type: 'Loft',
      bedrooms: 2,
      bathrooms: 2,
      beds: 3,
      rooms: 4,
      parking: 1,
      area: 160,
      yearBuilt: 2020,
      verified: true,
      availableFor: ['rent'],
      availableNow: true,
      deposit: 4600,
      hoa: 300,
      amenities: ['Invernadero interior', 'Laboratorio gastronómico', 'Cuarto de meditación', 'Cine inmersivo'],
      buildingAmenities: ['Terraza con domos', 'Cafetería de autor', 'Estudio de yoga', 'Roof top con fogatas'],
      safety: ['Guardianía 24/7', 'Ingreso biométrico', 'Sistema contra incendios'],
      highlights: ['Experiencia sensorial', 'Energía solar', 'Curaduría botánica'],
      latitude: 4.6486,
      longitude: -74.0656,
      images: [
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.85,
    reviewsCount: 13,
    latestReviews: [
      { id: 131, user: { name: 'Daniela C.' }, rating: 5, comment: 'Perfecto para creativos que aman la naturaleza.', date: '2025-02-01' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 14,
      title: 'CDMX Heritage Townhouse',
      subtitle: 'Casa patrimonial con patio central y estudio de música',
      description: 'Townhouse restaurada en la Roma Norte con tres niveles, patio central, estudio de música insonorizado y roof top privado con jacuzzi.',
      price: 2750,
      salePrice: 710000,
      currency: 'USD',
      location: 'Roma Norte, Ciudad de México',
      city: 'Ciudad de México',
      country: 'México',
      neighborhood: 'Roma Norte',
      type: 'Townhouse',
      bedrooms: 3,
      bathrooms: 3,
      beds: 3,
      rooms: 6,
      parking: 1,
      area: 190,
      yearBuilt: 1930,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 5500,
      hoa: 0,
      amenities: ['Estudio de música', 'Roof con jacuzzi', 'Biblioteca privada', 'Cuarto de servicio'],
      buildingAmenities: ['Seguridad vecinal', 'Estacionamiento techado', 'Bodegas', 'Espacio para bicis'],
      safety: ['Portón eléctrico', 'Cámaras comunitarias', 'Sistema de alarma'],
      highlights: ['Restaurada por arquitectos', 'Arte integrado', 'Zona gastronómica a pasos'],
      latitude: 19.4184,
      longitude: -99.1624,
      images: [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.95,
    reviewsCount: 18,
    latestReviews: [
      { id: 141, user: { name: 'Itzel M.' }, rating: 5, comment: 'La casa tiene alma, perfecta para sesiones creativas.', date: '2025-01-27' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 15,
      title: 'Miami Coliving Capsule',
      subtitle: 'Concepto coliving premium con cápsulas privadas',
      description: 'Planta completa convertida en coliving: cápsulas acústicas, suites privadas, cocina comunitaria profesional y programas de wellness semanal.',
      price: 1500,
      salePrice: 0,
      currency: 'USD',
      location: 'Wynwood, Miami, FL',
      city: 'Miami',
      country: 'USA',
      neighborhood: 'Wynwood',
      type: 'Coliving',
      bedrooms: 4,
      bathrooms: 4,
      beds: 8,
      rooms: 8,
      parking: 0,
      area: 220,
      yearBuilt: 2024,
      verified: true,
      availableFor: ['rent'],
      availableNow: true,
      deposit: 3000,
      hoa: 0,
      amenities: ['Cápsulas acústicas', 'Cocina profesional', 'Wellness studio', 'Terraza con fogón'],
      buildingAmenities: ['Programas de networking', 'Concierge digital', 'Lockers', 'Cowork'],
      safety: ['Ingreso facial', 'Control remoto', 'Sensores de ocupación'],
      highlights: ['Comunidad curada', 'Eventos semanales', 'Ideal nómadas'],
      latitude: -34.5812,
      longitude: -58.4352,
      images: [
        'https://images.unsplash.com/photo-1464146072230-91cabc968266?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1505692794400-0d9dc3497216?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.6,
    reviewsCount: 8,
    latestReviews: [
      { id: 151, user: { name: 'Bruno L.' }, rating: 5, comment: 'Eventos y comunidad increíbles.', date: '2025-02-02' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 16,
      title: 'Toronto Harbor View Residences',
      subtitle: 'Residencia esquinera con vistas al lago Ontario',
      description: 'Departamento de doble fachada con balcones envolventes, estudio acristalado y cocina Poggenpohl. Incluye lockers refrigerados para delivery y concierge wellness.',
      price: 3200,
      salePrice: 880000,
      currency: 'CAD',
      location: 'Harbourfront, Toronto',
      city: 'Toronto',
      country: 'Canadá',
      neighborhood: 'Queens Quay',
      type: 'Residencia premium',
      bedrooms: 3,
      bathrooms: 3,
      beds: 4,
      rooms: 6,
      parking: 2,
      area: 210,
      yearBuilt: 2022,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 6400,
      hoa: 480,
      amenities: ['Ventanas Low-E', 'Cuarto flexible', 'Cocina Poggenpohl', 'Lavadero independiente'],
      buildingAmenities: ['Piscina con muelle', 'Gimnasio con vista al lago', 'Lockers refrigerados', 'Concierge wellness'],
      safety: ['Seguridad 24/7', 'Acceso biométrico', 'Sistema de detección de agua'],
      highlights: ['Vistas al lago', 'Entrega de packages refrigerada', 'Servicios premium'],
      latitude: 43.6396,
      longitude: -79.3791,
      images: [
        'https://images.unsplash.com/photo-1501183638710-841dd1904471?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.9,
    reviewsCount: 16,
    latestReviews: [
      { id: 161, user: { name: 'Amelia P.' }, rating: 5, comment: 'El concierge se encarga de todo, experiencia 10/10.', date: '2025-02-10' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 17,
      title: 'Quito Andes Terrace',
      subtitle: 'Penthouse con terraza panorámica y fogón andino',
      description: 'Penthouse de dos niveles en Cumbayá con terraza perimetral, cocina show y home office con biblioteca. Incluye ascensor privado y paneles solares.',
      price: 2100,
      salePrice: 620000,
      currency: 'USD',
      location: 'Cumbayá, Quito',
      city: 'Quito',
      country: 'Ecuador',
      neighborhood: 'Cumbayá',
      type: 'Penthouse',
      bedrooms: 3,
      bathrooms: 3,
      beds: 4,
      rooms: 6,
      parking: 2,
      area: 200,
      yearBuilt: 2021,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 4200,
      hoa: 350,
      amenities: ['Terraza con fogón', 'Cocina show', 'Ascensor privado', 'Home office'],
      buildingAmenities: ['Club house', 'Piscina temperada', 'Cowork', 'Senderos verdes'],
      safety: ['Guardia motorizada', 'Control vehicular', 'Sensores sísmicos'],
      highlights: ['Vista 360°', 'Energía solar', 'Zona gourmet exterior'],
      latitude: -0.1971,
      longitude: -78.4361,
      images: [
        'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.7,
    reviewsCount: 12,
    latestReviews: [
      { id: 171, user: { name: 'Sofía V.' }, rating: 5, comment: 'La terraza es perfecta para eventos privados.', date: '2025-02-07' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 18,
      title: 'São Paulo Sky Garden',
      subtitle: 'Dúplex con jardín aéreo y estudio musical',
      description: 'Dúplex contemporáneo en Vila Madalena con jardín aéreo, estudio acústico y cocina abierta. Incluye domótica completa y estacionamiento con cargador EV.',
      price: 2700,
      salePrice: 720000,
      currency: 'USD',
      location: 'Vila Madalena, São Paulo',
      city: 'São Paulo',
      country: 'Brasil',
      neighborhood: 'Vila Madalena',
      type: 'Dúplex',
      bedrooms: 3,
      bathrooms: 3,
      beds: 4,
      rooms: 6,
      parking: 2,
      area: 195,
      yearBuilt: 2020,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 5400,
      hoa: 380,
      amenities: ['Jardín aéreo', 'Estudio musical', 'Domótica', 'Cocina abierta'],
      buildingAmenities: ['Piscina rooftop', 'Gimnasio', 'Cowork', 'Salón gourmet'],
      safety: ['Seguridad 24h', 'Control de acceso', 'Cámaras perimetrales'],
      highlights: ['Vistas urbanas', 'Espacios creativos', 'Cargador EV'],
      latitude: -23.5558,
      longitude: -46.6995,
      images: [
        'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1505692794400-0d9dc3497216?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.85,
    reviewsCount: 15,
    latestReviews: [
      { id: 181, user: { name: 'Thiago N.' }, rating: 5, comment: 'El jardín aéreo refresca todo el departamento.', date: '2025-01-25' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 19,
      title: 'Lima Cliff House',
      subtitle: 'Casa en acantilado con piscina infinita',
      description: 'Casa contemporánea sobre el acantilado de Barranco con piscina infinita, estudio creativo y suite principal con jacuzzi panorámico.',
      price: 3400,
      salePrice: 980000,
      currency: 'USD',
      location: 'Barranco, Lima',
      city: 'Lima',
      country: 'Perú',
      neighborhood: 'Barranco',
      type: 'Casa',
      bedrooms: 4,
      bathrooms: 4,
      beds: 5,
      rooms: 7,
      parking: 2,
      area: 260,
      yearBuilt: 2019,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 6800,
      hoa: 0,
      amenities: ['Piscina infinita', 'Estudio creativo', 'Jacuzzi panorámico', 'Doble cocina'],
      buildingAmenities: ['Seguridad privada', 'Acceso directo al malecón', 'Domos sociales'],
      safety: ['Circuito cerrado', 'Vigilancia vecinal', 'Rejas inteligentes'],
      highlights: ['Vista al mar', 'Arquitectura premiada', 'Espacios flexibles'],
      latitude: -12.1495,
      longitude: -77.0219,
      images: [
        'https://images.unsplash.com/photo-1505692794400-0d9dc3497216?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.95,
    reviewsCount: 20,
    latestReviews: [
      { id: 191, user: { name: 'Carla E.' }, rating: 5, comment: 'La piscina y las vistas son irreales.', date: '2025-02-11' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 20,
      title: 'Valencia Mediterranean Villa',
      subtitle: 'Villa mediterránea con patio central y huerto',
      description: 'Villa luminosa en Valencia con patio central, huerto urbano y cocina exterior. Incluye sala de música y biblioteca con techo de cristal.',
      price: 2450,
      salePrice: 650000,
      currency: 'EUR',
      location: 'Campanar, Valencia',
      city: 'Valencia',
      country: 'España',
      neighborhood: 'Campanar',
      type: 'Villa',
      bedrooms: 3,
      bathrooms: 3,
      beds: 4,
      rooms: 6,
      parking: 2,
      area: 210,
      yearBuilt: 2018,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 4900,
      hoa: 120,
      amenities: ['Huerto urbano', 'Patio central', 'Sala de música', 'Biblioteca'],
      buildingAmenities: ['Club social', 'Piscina climatizada', 'Zona infantil', 'Cowork rural'],
      safety: ['Portón eléctrico', 'Alarmas inteligentes', 'Sensores de movimiento'],
      highlights: ['Estilo mediterráneo', 'Espacios interiores-exteriores', 'Zona tranquila'],
      latitude: 39.4902,
      longitude: -0.4005,
      images: [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.8,
    reviewsCount: 14,
    latestReviews: [
      { id: 201, user: { name: 'Raquel B.' }, rating: 5, comment: 'El patio central es perfecto para reuniones.', date: '2025-01-30' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 21,
      title: 'Miami Beach Oceanfront',
      subtitle: 'Apartamento frente al mar con balcón panorámico',
      description: 'Apartamento moderno en Miami Beach con vista directa al océano, balcón amplio y acabados de lujo. Incluye cocina gourmet y acceso directo a la playa.',
      price: 4500,
      salePrice: 1200000,
      currency: 'USD',
      location: 'Ocean Drive, Miami Beach',
      city: 'Miami Beach',
      country: 'Estados Unidos',
      neighborhood: 'South Beach',
      type: 'Apartamento',
      bedrooms: 2,
      bathrooms: 2,
      beds: 3,
      rooms: 4,
      parking: 1,
      area: 145,
      yearBuilt: 2020,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 9000,
      hoa: 850,
      amenities: ['Balcón panorámico', 'Cocina gourmet', 'Vista al mar', 'Lavadero'],
      buildingAmenities: ['Piscina infinity', 'Gimnasio', 'Spa', 'Concierge 24/7', 'Acceso playa privado'],
      safety: ['Seguridad 24/7', 'Cámaras CCTV', 'Control de acceso'],
      highlights: ['Vista al océano', 'Ubicación premium', 'Acceso directo a playa'],
      latitude: 25.7907,
      longitude: -80.1300,
      images: [
        'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.9,
    reviewsCount: 28,
    latestReviews: [
      { id: 211, user: { name: 'Sarah K.' }, rating: 5, comment: 'La vista al océano es espectacular.', date: '2025-02-12' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 22,
      title: 'Paris Montmartre Studio',
      subtitle: 'Estudio artístico en el corazón de Montmartre',
      description: 'Estudio acogedor en Montmartre con luz natural, cocina equipada y baño completo. Perfecto para artistas y nómadas digitales.',
      price: 1200,
      salePrice: 380000,
      currency: 'EUR',
      location: 'Montmartre, París',
      city: 'París',
      country: 'Francia',
      neighborhood: 'Montmartre',
      type: 'Estudio',
      bedrooms: 0,
      bathrooms: 1,
      beds: 1,
      rooms: 1,
      parking: 0,
      area: 35,
      yearBuilt: 1920,
      verified: true,
      availableFor: ['rent'],
      availableNow: true,
      deposit: 2400,
      hoa: 150,
      amenities: ['Cocina equipada', 'Luz natural', 'Calefacción central'],
      buildingAmenities: ['Ascensor', 'Guardia', 'Bicicletero'],
      safety: ['Puerta blindada', 'Intercomunicador'],
      highlights: ['Zona artística', 'Cerca de Sacré-Cœur', 'Ambiente bohemio'],
      latitude: 48.8867,
      longitude: 2.3431,
      images: [
        'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.7,
    reviewsCount: 19,
    latestReviews: [
      { id: 221, user: { name: 'Pierre L.' }, rating: 5, comment: 'Ambiente perfecto para crear.', date: '2025-02-08' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 23,
      title: 'Tokyo Shibuya Loft',
      subtitle: 'Loft minimalista en el distrito de Shibuya',
      description: 'Loft moderno en Shibuya con diseño minimalista japonés, cocina integrada y espacio de trabajo. Cerca de estación de tren y vida nocturna.',
      price: 2800,
      salePrice: 750000,
      currency: 'USD',
      location: 'Shibuya, Tokio',
      city: 'Tokio',
      country: 'Japón',
      neighborhood: 'Shibuya',
      type: 'Loft',
      bedrooms: 1,
      bathrooms: 1,
      beds: 2,
      rooms: 2,
      parking: 0,
      area: 65,
      yearBuilt: 2019,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 5600,
      hoa: 200,
      amenities: ['Diseño minimalista', 'Cocina integrada', 'Espacio de trabajo', 'Tatami'],
      buildingAmenities: ['Recepción', 'Bicicletero', 'Lavandería compartida'],
      safety: ['Control de acceso', 'Cámaras de seguridad'],
      highlights: ['Cerca de Shibuya Crossing', 'Diseño japonés', 'Transporte público'],
      latitude: 35.6598,
      longitude: 139.7006,
      images: [
        'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.8,
    reviewsCount: 16,
    latestReviews: [
      { id: 231, user: { name: 'Yuki T.' }, rating: 5, comment: 'Perfecto para trabajar remoto.', date: '2025-02-05' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 24,
      title: 'Dubai Marina Penthouse',
      subtitle: 'Penthouse de lujo con vista al mar',
      description: 'Penthouse exclusivo en Dubai Marina con terraza privada, jacuzzi y vista panorámica. Incluye servicio de mayordomo y acceso a club privado.',
      price: 8500,
      salePrice: 2500000,
      currency: 'USD',
      location: 'Dubai Marina, Dubai',
      city: 'Dubai',
      country: 'Emiratos Árabes',
      neighborhood: 'Marina',
      type: 'Penthouse',
      bedrooms: 4,
      bathrooms: 4,
      beds: 5,
      rooms: 7,
      parking: 3,
      area: 350,
      yearBuilt: 2021,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 17000,
      hoa: 1200,
      amenities: ['Terraza privada', 'Jacuzzi', 'Cocina profesional', 'Home cinema', 'Mayordomo'],
      buildingAmenities: ['Club privado', 'Helipuerto', 'Spa de lujo', 'Gimnasio premium', 'Piscina infinity'],
      safety: ['Seguridad 24/7', 'Control biométrico', 'Sistema anti incendios'],
      highlights: ['Vista panorámica', 'Servicio de lujo', 'Ubicación exclusiva'],
      latitude: 25.0772,
      longitude: 55.1395,
      images: [
        'https://images.unsplash.com/photo-1505692794400-0d9dc3497216?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 5,
    reviewsCount: 12,
    latestReviews: [
      { id: 241, user: { name: 'Ahmed A.' }, rating: 5, comment: 'Experiencia de lujo incomparable.', date: '2025-02-11' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 25,
      title: 'Berlin Mitte Apartment',
      subtitle: 'Apartamento moderno en el centro de Berlín',
      description: 'Apartamento renovado en Mitte con techos altos, ventanales grandes y diseño contemporáneo. Cerca de galerías, restaurantes y transporte público.',
      price: 1800,
      salePrice: 480000,
      currency: 'EUR',
      location: 'Mitte, Berlín',
      city: 'Berlín',
      country: 'Alemania',
      neighborhood: 'Mitte',
      type: 'Apartamento',
      bedrooms: 2,
      bathrooms: 1,
      beds: 2,
      rooms: 3,
      parking: 1,
      area: 95,
      yearBuilt: 2015,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 3600,
      hoa: 280,
      amenities: ['Techos altos', 'Ventanales grandes', 'Cocina moderna', 'Calefacción central'],
      buildingAmenities: ['Ascensor', 'Bicicletero', 'Patio interior'],
      safety: ['Intercomunicador', 'Puerta blindada'],
      highlights: ['Zona cultural', 'Cerca de galerías', 'Vida nocturna'],
      latitude: 52.5200,
      longitude: 13.4050,
      images: [
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.6,
    reviewsCount: 22,
    latestReviews: [
      { id: 251, user: { name: 'Klaus M.' }, rating: 4, comment: 'Excelente ubicación y diseño.', date: '2025-02-03' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 26,
      title: 'Sydney Harbour View',
      subtitle: 'Apartamento con vista a la Ópera de Sídney',
      description: 'Apartamento premium con vista directa a la Ópera de Sídney y el puente. Incluye balcón privado, cocina gourmet y acabados de lujo.',
      price: 4200,
      salePrice: 1100000,
      currency: 'AUD',
      location: 'Circular Quay, Sídney',
      city: 'Sídney',
      country: 'Australia',
      neighborhood: 'Circular Quay',
      type: 'Apartamento',
      bedrooms: 2,
      bathrooms: 2,
      beds: 3,
      rooms: 4,
      parking: 1,
      area: 130,
      yearBuilt: 2018,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 8400,
      hoa: 650,
      amenities: ['Vista a la Ópera', 'Balcón privado', 'Cocina gourmet', 'Lavadero'],
      buildingAmenities: ['Piscina', 'Gimnasio', 'Concierge', 'Terraza comunitaria'],
      safety: ['Seguridad 24/7', 'Control de acceso', 'Cámaras CCTV'],
      highlights: ['Vista icónica', 'Ubicación premium', 'Cerca del puerto'],
      latitude: -33.8587,
      longitude: 151.2140,
      images: [
        'https://images.unsplash.com/photo-1501183638710-841dd1904471?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.9,
    reviewsCount: 31,
    latestReviews: [
      { id: 261, user: { name: 'Emma W.' }, rating: 5, comment: 'La vista es simplemente increíble.', date: '2025-02-10' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 27,
      title: 'Amsterdam Canal House',
      subtitle: 'Casa histórica junto al canal',
      description: 'Casa histórica restaurada junto al canal de Ámsterdam. Incluye jardín trasero, cocina moderna y espacios luminosos con techos altos.',
      price: 3200,
      salePrice: 850000,
      currency: 'EUR',
      location: 'Jordaan, Ámsterdam',
      city: 'Ámsterdam',
      country: 'Países Bajos',
      neighborhood: 'Jordaan',
      type: 'Casa',
      bedrooms: 3,
      bathrooms: 2,
      beds: 4,
      rooms: 5,
      parking: 0,
      area: 180,
      yearBuilt: 1890,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 6400,
      hoa: 0,
      amenities: ['Jardín trasero', 'Cocina moderna', 'Techos altos', 'Vista al canal'],
      buildingAmenities: ['Bicicletero', 'Almacén'],
      safety: ['Alarma', 'Puerta blindada'],
      highlights: ['Casa histórica', 'Junto al canal', 'Zona tranquila'],
      latitude: 52.3779,
      longitude: 4.9003,
      images: [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.8,
    reviewsCount: 18,
    latestReviews: [
      { id: 271, user: { name: 'Sophie V.' }, rating: 5, comment: 'Casa con mucho carácter y encanto.', date: '2025-02-07' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 28,
      title: 'Rio Copacabana Beachfront',
      subtitle: 'Apartamento frente a la playa de Copacabana',
      description: 'Apartamento moderno con vista directa a la playa de Copacabana. Incluye balcón amplio, cocina completa y acceso directo a la playa.',
      price: 2200,
      salePrice: 580000,
      currency: 'USD',
      location: 'Copacabana, Río de Janeiro',
      city: 'Río de Janeiro',
      country: 'Brasil',
      neighborhood: 'Copacabana',
      type: 'Apartamento',
      bedrooms: 2,
      bathrooms: 2,
      beds: 3,
      rooms: 3,
      parking: 1,
      area: 110,
      yearBuilt: 2017,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 4400,
      hoa: 320,
      amenities: ['Vista a la playa', 'Balcón amplio', 'Cocina completa', 'Aire acondicionado'],
      buildingAmenities: ['Piscina', 'Gimnasio', 'Concierge', 'Terraza con vista'],
      safety: ['Seguridad 24/7', 'Control de acceso', 'Cámaras'],
      highlights: ['Frente a Copacabana', 'Vista al mar', 'Vida playera'],
      latitude: -22.9712,
      longitude: -43.1822,
      images: [
        'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.7,
    reviewsCount: 25,
    latestReviews: [
      { id: 281, user: { name: 'Carlos S.' }, rating: 5, comment: 'Vista espectacular de la playa.', date: '2025-02-09' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 29,
      title: 'Vienna Historic Apartment',
      subtitle: 'Apartamento histórico en el centro de Viena',
      description: 'Apartamento restaurado en edificio histórico del siglo XIX. Incluye techos decorados, parquet original y ubicación céntrica cerca de palacios y museos.',
      price: 1900,
      salePrice: 520000,
      currency: 'EUR',
      location: 'Innere Stadt, Viena',
      city: 'Viena',
      country: 'Austria',
      neighborhood: 'Innere Stadt',
      type: 'Apartamento',
      bedrooms: 2,
      bathrooms: 1,
      beds: 2,
      rooms: 3,
      parking: 0,
      area: 85,
      yearBuilt: 1880,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 3800,
      hoa: 220,
      amenities: ['Techos decorados', 'Parquet original', 'Calefacción central', 'Cocina moderna'],
      buildingAmenities: ['Ascensor histórico', 'Patio interior'],
      safety: ['Intercomunicador', 'Puerta blindada'],
      highlights: ['Edificio histórico', 'Centro de Viena', 'Cerca de palacios'],
      latitude: 48.2082,
      longitude: 16.3738,
      images: [
        'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.8,
    reviewsCount: 17,
    latestReviews: [
      { id: 291, user: { name: 'Franz H.' }, rating: 5, comment: 'Encanto histórico preservado perfectamente.', date: '2025-02-04' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 30,
      title: 'Singapore Marina Bay Condo',
      subtitle: 'Condominio moderno con vista al puerto',
      description: 'Condominio de lujo en Marina Bay con vista al puerto, piscina infinity y acabados premium. Incluye gimnasio, spa y servicio de concierge.',
      price: 4800,
      salePrice: 1300000,
      currency: 'SGD',
      location: 'Marina Bay, Singapur',
      city: 'Singapur',
      country: 'Singapur',
      neighborhood: 'Marina Bay',
      type: 'Condominio',
      bedrooms: 3,
      bathrooms: 3,
      beds: 4,
      rooms: 5,
      parking: 2,
      area: 200,
      yearBuilt: 2020,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 9600,
      hoa: 750,
      amenities: ['Vista al puerto', 'Piscina infinity', 'Cocina gourmet', 'Home office'],
      buildingAmenities: ['Gimnasio premium', 'Spa', 'Concierge 24/7', 'Terraza comunitaria'],
      safety: ['Seguridad 24/7', 'Control biométrico', 'Sistema anti incendios'],
      highlights: ['Vista panorámica', 'Ubicación premium', 'Servicios de lujo'],
      latitude: 1.2810,
      longitude: 103.8608,
      images: [
        'https://images.unsplash.com/photo-1505692794400-0d9dc3497216?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.9,
    reviewsCount: 20,
    latestReviews: [
      { id: 301, user: { name: 'Li M.' }, rating: 5, comment: 'Vista y servicios excepcionales.', date: '2025-02-11' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 31,
      title: 'Prague Old Town Loft',
      subtitle: 'Loft en el corazón del casco antiguo',
      description: 'Loft espacioso en el casco antiguo de Praga con techos altos, vigas vistas y diseño contemporáneo. Cerca de la plaza principal y atracciones históricas.',
      price: 1600,
      salePrice: 420000,
      currency: 'EUR',
      location: 'Staré Město, Praga',
      city: 'Praga',
      country: 'República Checa',
      neighborhood: 'Staré Město',
      type: 'Loft',
      bedrooms: 1,
      bathrooms: 1,
      beds: 2,
      rooms: 2,
      parking: 0,
      area: 75,
      yearBuilt: 2016,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 3200,
      hoa: 180,
      amenities: ['Techos altos', 'Vigas vistas', 'Cocina moderna', 'Calefacción central'],
      buildingAmenities: ['Ascensor', 'Bicicletero'],
      safety: ['Intercomunicador', 'Puerta blindada'],
      highlights: ['Casco antiguo', 'Cerca de atracciones', 'Diseño único'],
      latitude: 50.0875,
      longitude: 14.4214,
      images: [
        'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.7,
    reviewsCount: 14,
    latestReviews: [
      { id: 311, user: { name: 'Jan N.' }, rating: 5, comment: 'Ubicación perfecta en el centro histórico.', date: '2025-02-06' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 32,
      title: 'Bangkok Sukhumvit Apartment',
      subtitle: 'Apartamento moderno en Sukhumvit',
      description: 'Apartamento contemporáneo en Sukhumvit con piscina, gimnasio y acceso a BTS. Incluye cocina completa y espacios modernos.',
      price: 1500,
      salePrice: 350000,
      currency: 'USD',
      location: 'Sukhumvit, Bangkok',
      city: 'Bangkok',
      country: 'Tailandia',
      neighborhood: 'Sukhumvit',
      type: 'Apartamento',
      bedrooms: 1,
      bathrooms: 1,
      beds: 2,
      rooms: 2,
      parking: 1,
      area: 60,
      yearBuilt: 2019,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 3000,
      hoa: 150,
      amenities: ['Cocina completa', 'Aire acondicionado', 'Balcón', 'Lavadero'],
      buildingAmenities: ['Piscina', 'Gimnasio', 'Terraza', 'Cowork'],
      safety: ['Seguridad 24/7', 'Control de acceso', 'Cámaras'],
      highlights: ['Cerca de BTS', 'Zona comercial', 'Vida moderna'],
      latitude: 13.7367,
      longitude: 100.5231,
      images: [
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.6,
    reviewsCount: 19,
    latestReviews: [
      { id: 321, user: { name: 'Niran P.' }, rating: 4, comment: 'Excelente ubicación y amenities.', date: '2025-02-02' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 33,
      title: 'Istanbul Bosphorus View',
      subtitle: 'Apartamento con vista al Bósforo',
      description: 'Apartamento elegante con vista panorámica al Bósforo. Incluye balcón privado, cocina moderna y acabados de calidad.',
      price: 1800,
      salePrice: 450000,
      currency: 'USD',
      location: 'Bebek, Estambul',
      city: 'Estambul',
      country: 'Turquía',
      neighborhood: 'Bebek',
      type: 'Apartamento',
      bedrooms: 2,
      bathrooms: 2,
      beds: 3,
      rooms: 3,
      parking: 1,
      area: 100,
      yearBuilt: 2018,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 3600,
      hoa: 250,
      amenities: ['Vista al Bósforo', 'Balcón privado', 'Cocina moderna', 'Calefacción'],
      buildingAmenities: ['Piscina', 'Gimnasio', 'Concierge', 'Terraza'],
      safety: ['Seguridad 24/7', 'Control de acceso'],
      highlights: ['Vista al Bósforo', 'Zona exclusiva', 'Cerca del mar'],
      latitude: 41.0785,
      longitude: 29.0433,
      images: [
        'https://images.unsplash.com/photo-1501183638710-841dd1904471?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.8,
    reviewsCount: 16,
    latestReviews: [
      { id: 331, user: { name: 'Ayşe K.' }, rating: 5, comment: 'Vista increíble al Bósforo.', date: '2025-02-08' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 34,
      title: 'Cape Town Waterfront Villa',
      subtitle: 'Villa moderna con vista a Table Mountain',
      description: 'Villa contemporánea con vista a Table Mountain y el océano. Incluye piscina privada, jardín y espacios amplios para entretenimiento.',
      price: 3500,
      salePrice: 950000,
      currency: 'USD',
      location: 'Camps Bay, Ciudad del Cabo',
      city: 'Ciudad del Cabo',
      country: 'Sudáfrica',
      neighborhood: 'Camps Bay',
      type: 'Villa',
      bedrooms: 4,
      bathrooms: 4,
      beds: 5,
      rooms: 7,
      parking: 3,
      area: 280,
      yearBuilt: 2019,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 7000,
      hoa: 0,
      amenities: ['Piscina privada', 'Jardín', 'Vista a Table Mountain', 'Cocina gourmet', 'Home cinema'],
      buildingAmenities: ['Seguridad privada', 'Acceso directo a playa'],
      safety: ['Alarma', 'Cámaras de seguridad', 'Rejas'],
      highlights: ['Vista panorámica', 'Piscina privada', 'Ubicación exclusiva'],
      latitude: -33.9566,
      longitude: 18.3762,
      images: [
        'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.9,
    reviewsCount: 13,
    latestReviews: [
      { id: 341, user: { name: 'James M.' }, rating: 5, comment: 'Vista espectacular y espacios increíbles.', date: '2025-02-09' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 35,
      title: 'Seoul Gangnam Studio',
      subtitle: 'Estudio moderno en Gangnam',
      description: 'Estudio compacto y moderno en Gangnam con diseño eficiente, cocina integrada y acceso a transporte público. Perfecto para profesionales jóvenes.',
      price: 1400,
      salePrice: 320000,
      currency: 'USD',
      location: 'Gangnam, Seúl',
      city: 'Seúl',
      country: 'Corea del Sur',
      neighborhood: 'Gangnam',
      type: 'Estudio',
      bedrooms: 0,
      bathrooms: 1,
      beds: 1,
      rooms: 1,
      parking: 0,
      area: 40,
      yearBuilt: 2020,
      verified: true,
      availableFor: ['rent'],
      availableNow: true,
      deposit: 2800,
      hoa: 120,
      amenities: ['Diseño eficiente', 'Cocina integrada', 'Aire acondicionado', 'Calefacción'],
      buildingAmenities: ['Gimnasio', 'Lavandería', 'Bicicletero'],
      safety: ['Control de acceso', 'Cámaras'],
      highlights: ['Zona comercial', 'Transporte público', 'Vida moderna'],
      latitude: 37.4979,
      longitude: 127.0276,
      images: [
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.5,
    reviewsCount: 11,
    latestReviews: [
      { id: 351, user: { name: 'Min J.' }, rating: 4, comment: 'Perfecto para profesionales jóvenes.', date: '2025-02-01' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 36,
      title: 'Rome Trastevere Apartment',
      subtitle: 'Apartamento en el barrio bohemio de Trastevere',
      description: 'Apartamento encantador en Trastevere con balcón, techos altos y diseño italiano. Cerca de restaurantes, bares y vida nocturna.',
      price: 2000,
      salePrice: 540000,
      currency: 'EUR',
      location: 'Trastevere, Roma',
      city: 'Roma',
      country: 'Italia',
      neighborhood: 'Trastevere',
      type: 'Apartamento',
      bedrooms: 2,
      bathrooms: 1,
      beds: 2,
      rooms: 3,
      parking: 0,
      area: 90,
      yearBuilt: 1950,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 4000,
      hoa: 200,
      amenities: ['Balcón', 'Techos altos', 'Cocina italiana', 'Calefacción'],
      buildingAmenities: ['Ascensor', 'Patio interior'],
      safety: ['Intercomunicador', 'Puerta blindada'],
      highlights: ['Barrio bohemio', 'Vida nocturna', 'Cerca del centro'],
      latitude: 41.8897,
      longitude: 12.4694,
      images: [
        'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.7,
    reviewsCount: 20,
    latestReviews: [
      { id: 361, user: { name: 'Marco R.' }, rating: 5, comment: 'Barrio con mucho carácter y vida.', date: '2025-02-05' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 37,
      title: 'Mexico City Polanco Penthouse',
      subtitle: 'Penthouse de lujo en Polanco',
      description: 'Penthouse exclusivo en Polanco con terraza privada, jacuzzi y vista panorámica. Incluye cocina gourmet, home office y servicio de concierge.',
      price: 3800,
      salePrice: 980000,
      currency: 'USD',
      location: 'Polanco, Ciudad de México',
      city: 'Ciudad de México',
      country: 'México',
      neighborhood: 'Polanco',
      type: 'Penthouse',
      bedrooms: 3,
      bathrooms: 3,
      beds: 4,
      rooms: 6,
      parking: 2,
      area: 240,
      yearBuilt: 2021,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 7600,
      hoa: 550,
      amenities: ['Terraza privada', 'Jacuzzi', 'Cocina gourmet', 'Home office', 'Home cinema'],
      buildingAmenities: ['Piscina infinity', 'Gimnasio premium', 'Spa', 'Concierge 24/7'],
      safety: ['Seguridad 24/7', 'Control biométrico', 'Sistema anti incendios'],
      highlights: ['Vista panorámica', 'Zona exclusiva', 'Servicios de lujo'],
      latitude: 19.4326,
      longitude: -99.1994,
      images: [
        'https://images.unsplash.com/photo-1505692794400-0d9dc3497216?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.9,
    reviewsCount: 15,
    latestReviews: [
      { id: 371, user: { name: 'Patricia L.' }, rating: 5, comment: 'Penthouse de ensueño con todos los lujos.', date: '2025-02-10' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 38,
      title: 'Stockholm Södermalm Loft',
      subtitle: 'Loft escandinavo en Södermalm',
      description: 'Loft moderno con diseño escandinavo en Södermalm. Incluye espacios abiertos, cocina integrada y luz natural abundante.',
      price: 2100,
      salePrice: 560000,
      currency: 'SEK',
      location: 'Södermalm, Estocolmo',
      city: 'Estocolmo',
      country: 'Suecia',
      neighborhood: 'Södermalm',
      type: 'Loft',
      bedrooms: 1,
      bathrooms: 1,
      beds: 2,
      rooms: 2,
      parking: 0,
      area: 70,
      yearBuilt: 2017,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 4200,
      hoa: 300,
      amenities: ['Diseño escandinavo', 'Espacios abiertos', 'Cocina integrada', 'Calefacción central'],
      buildingAmenities: ['Ascensor', 'Bicicletero', 'Lavandería'],
      safety: ['Intercomunicador', 'Puerta blindada'],
      highlights: ['Diseño moderno', 'Zona trendy', 'Luz natural'],
      latitude: 59.3151,
      longitude: 18.0722,
      images: [
        'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.6,
    reviewsCount: 13,
    latestReviews: [
      { id: 381, user: { name: 'Erik S.' }, rating: 5, comment: 'Diseño escandinavo impecable.', date: '2025-02-04' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 39,
      title: 'Coral Gables Duplex',
      subtitle: 'Dúplex en Coral Gables',
      description: 'Dúplex restaurado en Coral Gables. Incluye patio privado, techos altos y ubicación cerca de Miracle Mile y zonas verdes.',
      price: 2900,
      salePrice: 780000,
      currency: 'USD',
      location: 'Coral Gables, Miami, FL',
      city: 'Miami',
      country: 'USA',
      neighborhood: 'Coral Gables',
      type: 'Dúplex',
      bedrooms: 3,
      bathrooms: 2,
      beds: 4,
      rooms: 5,
      parking: 1,
      area: 170,
      yearBuilt: 1925,
      verified: true,
      availableFor: ['rent', 'buy'],
      availableNow: true,
      deposit: 5800,
      hoa: 450,
      amenities: ['Balcón francés', 'Techos decorados', 'Cocina moderna', 'Calefacción central'],
      buildingAmenities: ['Ascensor histórico', 'Portería', 'Patio interior'],
      safety: ['Portería 24h', 'Intercomunicador', 'Puerta blindada'],
      highlights: ['Edificio histórico', 'Zona exclusiva', 'Cerca de atracciones'],
      latitude: -34.5898,
      longitude: -58.3933,
      images: [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.8,
    reviewsCount: 24,
    latestReviews: [
      { id: 391, user: { name: 'Ana G.' }, rating: 5, comment: 'Dúplex con mucho carácter histórico.', date: '2025-02-07' }
    ],
    isAvailable: true
  },
  {
    property: {
      id: 40,
      title: 'Lisbon Alfama Studio',
      subtitle: 'Estudio en el barrio histórico de Alfama',
      description: 'Estudio acogedor en Alfama con azulejos portugueses, cocina compacta y ubicación única cerca del castillo y miradores.',
      price: 1100,
      salePrice: 280000,
      currency: 'EUR',
      location: 'Alfama, Lisboa',
      city: 'Lisboa',
      country: 'Portugal',
      neighborhood: 'Alfama',
      type: 'Estudio',
      bedrooms: 0,
      bathrooms: 1,
      beds: 1,
      rooms: 1,
      parking: 0,
      area: 30,
      yearBuilt: 1950,
      verified: true,
      availableFor: ['rent'],
      availableNow: true,
      deposit: 2200,
      hoa: 100,
      amenities: ['Azulejos portugueses', 'Cocina compacta', 'Calefacción'],
      buildingAmenities: [],
      safety: ['Intercomunicador'],
      highlights: ['Barrio histórico', 'Cerca del castillo', 'Vistas al río'],
      latitude: 38.7105,
      longitude: -9.1333,
      images: [
        'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?auto=format&fit=crop&w=1400&q=80'
      ]
    },
    averageRating: 4.5,
    reviewsCount: 12,
    latestReviews: [
      { id: 401, user: { name: 'João P.' }, rating: 4, comment: 'Ubicación única en el barrio más antiguo.', date: '2025-02-03' }
    ],
    isAvailable: true
  }
]

type SyntheticLocation = {
  location: string
  city: string
  country: string
  neighborhood: string
  type: string
  currency: string
  latitude: number
  longitude: number
}

const syntheticLocations: SyntheticLocation[] = [
  { location: 'South Beach, Miami, FL', city: 'Miami', country: 'USA', neighborhood: 'South Beach', type: 'Apartamento boutique', currency: 'USD', latitude: 25.7907, longitude: -80.1300 },
  { location: 'Providencia, Santiago', city: 'Santiago', country: 'Chile', neighborhood: 'Providencia', type: 'Departamento moderno', currency: 'USD', latitude: -33.4263, longitude: -70.6151 },
  { location: 'Miraflores, Lima', city: 'Lima', country: 'Perú', neighborhood: 'Miraflores', type: 'Loft creativo', currency: 'USD', latitude: -12.1139, longitude: -77.0337 },
  { location: 'El Poblado, Medellín', city: 'Medellín', country: 'Colombia', neighborhood: 'El Poblado', type: 'Residencia premium', currency: 'USD', latitude: 6.2088, longitude: -75.5676 },
  { location: 'Roma Norte, Ciudad de México', city: 'Ciudad de México', country: 'México', neighborhood: 'Roma Norte', type: 'Townhouse moderno', currency: 'USD', latitude: 19.4188, longitude: -99.1621 },
  { location: 'Brickell, Miami', city: 'Miami', country: 'Estados Unidos', neighborhood: 'Brickell', type: 'Condominio', currency: 'USD', latitude: 25.7617, longitude: -80.1918 },
  { location: 'Gracia, Barcelona', city: 'Barcelona', country: 'España', neighborhood: 'Gracia', type: 'Loft mediterráneo', currency: 'EUR', latitude: 41.4025, longitude: 2.1564 },
  { location: 'Shinjuku, Tokio', city: 'Tokio', country: 'Japón', neighborhood: 'Shinjuku', type: 'Suite urbana', currency: 'USD', latitude: 35.6938, longitude: 139.7034 },
  { location: 'Downtown, Dubai', city: 'Dubai', country: 'Emiratos Árabes', neighborhood: 'Downtown', type: 'Penthouse', currency: 'USD', latitude: 25.2048, longitude: 55.2708 },
  { location: 'Canggu, Bali', city: 'Bali', country: 'Indonesia', neighborhood: 'Canggu', type: 'Villa tropical', currency: 'USD', latitude: -8.6478, longitude: 115.1385 },
  { location: 'Notting Hill, Londres', city: 'Londres', country: 'Reino Unido', neighborhood: 'Notting Hill', type: 'Casa adosada', currency: 'GBP', latitude: 51.5096, longitude: -0.1961 },
  { location: 'Kreuzberg, Berlín', city: 'Berlín', country: 'Alemania', neighborhood: 'Kreuzberg', type: 'Loft industrial', currency: 'EUR', latitude: 52.4997, longitude: 13.4034 }
]

const amenityPool = [
  'Cocina gourmet',
  'Balcón corrido',
  'Domótica',
  'Lavadero independiente',
  'Terraza privada',
  'Home office',
  'Estacionamiento cubierto',
  'Paneles solares',
  'Jacuzzi',
  'Sauna'
]

const buildingAmenityPool = [
  'Piscina climatizada',
  'Gimnasio 24/7',
  'Cowork',
  'Spa',
  'Roof top con parrilla',
  'Concierge 24/7',
  'Jardines',
  'Kids club',
  'Sala de cine',
  'Lockers inteligentes'
]

const highlightsPool = [
  'Vista panorámica',
  'Ideal para home office',
  'Pet friendly',
  'Servicios premium',
  'Diseño sustentable',
  'Entrega inmediata',
  'Barrio creativo',
  'Cerca del mar',
  'Listo para mudarse',
  'Contrato flexible'
]

function pickItems<T>(source: T[], count: number, seed: number) {
  const items: T[] = []
  for (let i = 0; i < count; i++) {
    const index = (seed + i) % source.length
    items.push(source[index])
  }
  return Array.from(new Set(items))
}

function createSyntheticProperty(id: number): PropertySummary {
  const locationSeed = (id - 41) % syntheticLocations.length
  const location = syntheticLocations[locationSeed]
  const bedrooms = 1 + ((id + locationSeed) % 4)
  const bathrooms = Math.max(1, bedrooms - (id % 2 === 0 ? 0 : 1))
  const rooms = bedrooms + 1 + (id % 3)
  const basePrice = 900 + ((id * 37) % 2600)
  const price = Math.round(basePrice / 10) * 10
  const salePrice = price * 260
  const isRentAndBuy = id % 3 !== 0
  const availableFor: TransactionMode[] = isRentAndBuy ? ['rent', 'buy'] : ['rent']
  const averageRating = 4 + ((id % 10) * 0.1)
  const reviewCount = 8 + (id % 25)
  const reviewDate = `2025-02-${(id % 27 + 1).toString().padStart(2, '0')}`

  return {
    property: {
      id,
      title: `${location.city} Signature ${id}`,
      subtitle: `${location.type} con amenities inteligentes`,
      description: `Propiedad ficticia ${id} pensada para mostrar el potencial de RIAL App. Incluye espacios flexibles, acabados premium y servicios diseñados para nómadas digitales.`,
      descriptionEn: `Sample property ${id} to showcase RIAL App. Features flexible spaces, premium finishes and services designed for digital nomads.`,
      price,
      salePrice,
      currency: location.currency,
      location: location.location,
      city: location.city,
      country: location.country,
      neighborhood: location.neighborhood,
      type: location.type,
      bedrooms,
      bathrooms,
      beds: bedrooms + 1,
      rooms,
      parking: id % 2 === 0 ? 2 : 1,
      area: 80 + (id % 9) * 15,
      yearBuilt: 2016 + (id % 10),
      verified: true,
      availableFor,
      availableNow: id % 5 !== 0,
      deposit: price * 2,
      hoa: Math.round(price * 0.15),
      amenities: pickItems(amenityPool, 4, id),
      buildingAmenities: pickItems(buildingAmenityPool, 4, id + 2),
      safety: ['Acceso biométrico', 'CCTV 4K', 'Sensores inteligentes'],
      highlights: pickItems(highlightsPool, 3, id + 4),
      latitude: location.latitude + (id % 3) * 0.001,
      longitude: location.longitude - (id % 3) * 0.001,
      images: [
        `https://images.unsplash.com/photo-1505692794400-0d9dc3497216?auto=format&fit=crop&w=1200&q=80&id=${id}`,
        `https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80&id=${id}`
      ]
    },
    averageRating: Math.min(5, parseFloat(averageRating.toFixed(2))),
    reviewsCount: reviewCount,
    latestReviews: [
      {
        id: Number(`${id}1`),
        user: { name: 'Cliente verificado' },
        rating: Math.min(5, parseFloat(averageRating.toFixed(1))),
        comment: 'Experiencia fluida y amenities muy completos.',
        date: reviewDate
      }
    ],
    isAvailable: id % 7 !== 0
  }
}

const generatedPropertySummaries: PropertySummary[] = Array.from({ length: 60 }, (_, index) =>
  createSyntheticProperty(41 + index)
)

const mockPropertySummaries: PropertySummary[] = [
  ...basePropertySummaries,
  ...generatedPropertySummaries
]

function normalize(value?: string | number | boolean) {
  if (value === undefined || value === null) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value).toLowerCase()
}

/** Quita acentos para búsqueda flexible (ej. "córdoba" encuentra "Cordoba"). */
function removeAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

/** Expande términos de búsqueda a sinónimos para encontrar más resultados. */
const SEARCH_SYNONYMS: Record<string, string[]> = {
  depa: ['departamento', 'apartment', 'depto'],
  depto: ['departamento', 'apartment', 'depa'],
  monoambiente: ['estudio', 'studio', 'mono ambiente', '1 ambiente'],
  estudio: ['studio', 'monoambiente', 'mono ambiente'],
  pileta: ['piscina', 'pool', 'natación'],
  piscina: ['pileta', 'pool'],
  cochera: ['estacionamiento', 'parking', 'garage', 'auto'],
  garage: ['estacionamiento', 'parking', 'cochera'],
  estacionamiento: ['parking', 'cochera', 'garage'],
  parking: ['estacionamiento', 'cochera', 'garage'],
  mascotas: ['pet', 'mascota', 'perro', 'gato', 'pet friendly'],
  pet: ['mascotas', 'mascota', 'pet friendly'],
  amueblado: ['amoblado', 'furnished', 'muebles'],
  amoblado: ['amueblado', 'furnished', 'muebles'],
  wifi: ['internet', 'wi-fi', 'conexión'],
  aire: ['aire acondicionado', 'ac', 'climatización', 'clima'],
  clima: ['aire acondicionado', 'calefacción', 'heating'],
  ascensor: ['elevator', 'elevador'],
  balcon: ['balcón', 'balcony', 'terraza'],
  terraza: ['balcón', 'balcony', 'terrace'],
  gimnasio: ['gym', 'gimnasio', 'fitness'],
  gym: ['gimnasio', 'fitness'],
  habitacion: ['habitaciones', 'dormitorio', 'bedroom', 'dormitorios'],
  habitaciones: ['dormitorios', 'bedrooms', 'ambientes'],
  ambientes: ['habitaciones', 'rooms', 'amb'],
  baño: ['baños', 'bathroom', 'bathrooms'],
  baños: ['bathroom', 'bathrooms'],
  puer: ['puerto'],
  brickell: ['brickell', 'downtown miami'],
  southbeach: ['south beach', 'sobe', 'miami beach'],
  coral: ['coral gables', 'coral gables fl'],
  wynwood: ['wynwood', 'midtown miami'],
  miami: ['miami', 'miami fl', 'miami-dade'],
  centro: ['centro', 'microcentro', 'city'],
  house: ['casa', 'home', 'vivienda', 'chalet', 'duplex', 'townhouse'],
  casa: ['house', 'home', 'vivienda', 'chalet'],
  apartment: ['departamento', 'depto', 'flat', 'condo', 'unit'],
  departamento: ['apartment', 'depto', 'flat'],
}

function expandQueryTerms(word: string): string[] {
  const lower = word.toLowerCase().trim()
  const normalized = removeAccents(lower)
  const synonyms = SEARCH_SYNONYMS[lower] || SEARCH_SYNONYMS[normalized]
  const terms = [lower, normalized]
  if (synonyms) terms.push(...synonyms)
  return [...new Set(terms)]
}

function buildHaystack(property: PropertyData) {
  const haystackRaw = [
    property.title.split('·')[0].trim(),
    property.title,
    property.subtitle,
    property.description,
    property.descriptionEn || '',
    property.location,
    property.neighborhood,
    property.city,
    property.country,
    property.type,
    property.highlights.join(' '),
    property.amenities.join(' '),
    property.buildingAmenities.join(' '),
  ].join(' ')
  return removeAccents(haystackRaw.toLowerCase())
}

/** Cada token (con sinónimos) debe aparecer en el texto agregado de la propiedad (AND). */
function matchesParsedTextTokens(property: PropertyData, tokens: string[]) {
  if (!tokens.length) return true
  const haystack = buildHaystack(property)
  const buildingName = removeAccents(property.title.split('·')[0].trim().toLowerCase())
  const locationNorm = removeAccents(property.location.toLowerCase())
  const neighborhoodNorm = removeAccents(property.neighborhood.toLowerCase())
  const cityNorm = removeAccents(property.city.toLowerCase())

  return tokens.every((token) => {
    const full = removeAccents(token.toLowerCase())
    if (
      buildingName.includes(full) ||
      locationNorm.includes(full) ||
      neighborhoodNorm.includes(full) ||
      cityNorm.includes(full)
    ) {
      return true
    }
    const terms = expandQueryTerms(token)
    return terms.some(
      (term) => haystack.includes(term) || haystack.includes(removeAccents(term.toLowerCase()))
    )
  })
}

function expandAmenityCanonical(canonical: string): string[] {
  const key = canonical.toLowerCase()
  const map: Record<string, string[]> = {
    pool: ['pool', 'piscina', 'pileta'],
    gym: ['gym', 'gimnasio', 'fitness'],
    parking: ['parking', 'estacionamiento', 'cochera', 'garage'],
    wifi: ['wifi', 'wi-fi', 'internet'],
    'air conditioning': ['aire', 'ac', 'climat', 'air conditioning', 'climatización', 'climatizacion'],
    heating: ['calefacción', 'calefaccion', 'heating'],
    balcony: ['balcón', 'balcony', 'balcon'],
    elevator: ['ascensor', 'elevator', 'elevador'],
    furnished: ['amueblado', 'amoblado', 'furnished', 'muebles'],
    'pet friendly': ['pet friendly', 'pet', 'mascota', 'mascotas'],
  }
  return map[key] || [key]
}

export function filterMockProperties(filters: any) {
  const parsed = parsePropertySearchQuery(filters.query || '')
  const filtered = mockPropertySummaries.filter(({ property, averageRating }) => {
    if (filters.location && !property.location.toLowerCase().includes(filters.location.toLowerCase())) return false
    if (filters.query && !matchesParsedTextTokens(property, parsed.textTokens)) return false
    if (filters.minPrice && property.price < Number(filters.minPrice)) return false
    if (filters.maxPrice && property.price > Number(filters.maxPrice)) return false
    if (filters.bedrooms != null && filters.bedrooms !== '' && property.bedrooms !== Number(filters.bedrooms)) return false
    if (filters.bedrooms == null && parsed.bedroomsExact != null && property.bedrooms !== parsed.bedroomsExact) return false
    if (filters.bathrooms != null && filters.bathrooms !== '' && property.bathrooms !== Number(filters.bathrooms)) return false
    if (filters.bathrooms == null && parsed.bathroomsExact != null && property.bathrooms !== parsed.bathroomsExact) return false
    if (filters.propertyType && !property.type.toLowerCase().includes(filters.propertyType.toLowerCase())) return false
    if (filters.rooms != null && filters.rooms !== '' && property.rooms !== Number(filters.rooms)) return false
    if (filters.rooms == null && parsed.roomsExact != null && property.rooms !== parsed.roomsExact) return false
    if (filters.rating && averageRating < Number(filters.rating)) return false
    if (filters.verified && !property.verified) return false

    const chipAmenities = filters.amenities?.length
      ? Array.isArray(filters.amenities)
        ? filters.amenities
        : [filters.amenities]
      : []
    const amenityGroups: string[][] = chipAmenities.map((amenity: string) => {
      const needle = amenity.toLowerCase().trim()
      const normalizedNeedle = needle
        .replace(/piscina/i, 'piscina')
        .replace(/gimnasio/i, 'gimnasio')
        .replace(/estacionamiento|parking|cochera/i, 'estacionamiento')
        .replace(/wifi|wi-fi/i, 'wifi')
        .replace(/aire acondicionado|ac|climatización/i, 'aire')
        .replace(/calefacción|heating/i, 'calefacción')
        .replace(/ascensor|elevator/i, 'ascensor')
        .replace(/amueblado|furnished/i, 'amueblado')
        .replace(/pet friendly|mascotas/i, 'pet')
        .replace(/balcón|balcony/i, 'balcón')
        .replace(/terraza|terrace/i, 'terraza')
      return [needle, normalizedNeedle].filter((v, i, a) => a.indexOf(v) === i)
    })
    for (const c of parsed.amenityTerms) {
      amenityGroups.push(expandAmenityCanonical(c))
    }

    if (amenityGroups.length) {
      const allAmenities = [...property.amenities, ...property.buildingAmenities]
      const hasAll = amenityGroups.every((group) =>
        group.some((needle) =>
          allAmenities.some((a) => {
            const amenityLower = a.toLowerCase()
            return amenityLower.includes(needle)
          })
        )
      )
      if (!hasAll) return false
    }
    return true
  })

  if (filters.sort === 'price_asc') {
    filtered.sort((a, b) => a.property.price - b.property.price)
  } else if (filters.sort === 'price_desc') {
    filtered.sort((a, b) => b.property.price - a.property.price)
  }

  return filtered
}

export function getMockProperties(filters: any) {
  const list = filterMockProperties(filters)
  const page = Number(filters.page) || 1
  const pageSize = Number(filters.pageSize) || 12
  const start = (page - 1) * pageSize
  const end = start + pageSize
  return {
    items: list.slice(start, end),
    total: list.length
  }
}

export function getMockPropertySummary(id: number): PropertySummary | null {
  return mockPropertySummaries.find(({ property }) => property.id === id) || null
}

