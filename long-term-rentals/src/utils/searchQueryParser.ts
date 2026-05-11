/**
 * Interpreta consultas de búsqueda en lenguaje natural para listados:
 * números + habitaciones/ambientes/baños, amenities, y texto libre por tokens
 * (evita exigir la frase completa en un solo `contains`).
 */

export type ParsedPropertySearchQuery = {
  roomsExact?: number
  bedroomsExact?: number
  bathroomsExact?: number
  amenityTerms: string[]
  /** Palabras significativas; cada una debe aparecer en título, descripción o ubicación (AND). */
  textTokens: string[]
}

const STOP_WORDS = new Set(
  [
    'a',
    'an',
    'the',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'from',
    'by',
    'as',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'can',
    'about',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'between',
    'under',
    'again',
    'further',
    'then',
    'once',
    'here',
    'there',
    'when',
    'where',
    'why',
    'how',
    'all',
    'each',
    'every',
    'both',
    'few',
    'more',
    'most',
    'other',
    'some',
    'such',
    'no',
    'nor',
    'not',
    'only',
    'own',
    'same',
    'so',
    'than',
    'too',
    'very',
    'just',
    'looking',
    'need',
    'want',
    'search',
    'find',
    'rent',
    'alquiler',
    'alquilar',
    'busco',
    'buscar',
    'quiero',
    'necesito',
    'una',
    'uno',
    'unos',
    'unas',
    'el',
    'la',
    'los',
    'las',
    'un',
    'de',
    'del',
    'al',
    'y',
    'o',
    'en',
    'con',
    'por',
    'para',
    'que',
    'como',
    'muy',
    'mas',
    'más',
    'menos',
    'sin',
    'sobre',
    'entre',
    'este',
    'esta',
    'estos',
    'estas',
    'ese',
    'esa',
    'eso',
    'propiedad',
  ].map((w) => w.toLowerCase())
)

function normalizeAccents(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function tokenizeFreetext(working: string, extractedNumbers: Set<string>): string[] {
  const raw = working
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)

  const out: string[] = []
  for (const t of raw) {
    const low = t.toLowerCase()
    if (STOP_WORDS.has(low)) continue
    if (low.length < 2) continue
    if (/^\d+$/.test(low) && extractedNumbers.has(low)) continue
    out.push(low)
  }
  return [...new Set(out)].slice(0, 12)
}

const AMENITY_LEXICON: Array<{ canonical: string; test: (q: string) => boolean }> = [
  { canonical: 'pool', test: (q) => /\b(pool|piscina|pileta)\b/i.test(q) },
  { canonical: 'gym', test: (q) => /\b(gym|gimnasio|fitness)\b/i.test(q) },
  {
    canonical: 'parking',
    test: (q) => /\b(parking|estacionamiento|cochera|garage)\b/i.test(q),
  },
  { canonical: 'wifi', test: (q) => /\b(wifi|wi-?fi|internet)\b/i.test(q) },
  {
    canonical: 'air conditioning',
    test: (q) =>
      /\b(air conditioning|aire acondicionado|climatizacion|climatización)\b/i.test(q) ||
      /\ba\/?c\b/i.test(q),
  },
  { canonical: 'heating', test: (q) => /\b(heating|calefaccion|calefacción)\b/i.test(q) },
  { canonical: 'balcony', test: (q) => /\b(balcony|balcón|balcon)\b/i.test(q) },
  { canonical: 'elevator', test: (q) => /\b(elevator|ascensor|elevador)\b/i.test(q) },
  {
    canonical: 'furnished',
    test: (q) => /\b(furnished|amueblado|amoblado|muebles)\b/i.test(q),
  },
  {
    canonical: 'pet friendly',
    test: (q) =>
      /\b(pet friendly|pet-friendly|mascotas|mascota)\b/i.test(q) ||
      (/\bpermiten\b/i.test(q) && /\bmascotas\b/i.test(q)),
  },
]

/**
 * Extrae criterios estructurados y tokens de texto a partir de la consulta del usuario.
 */
export function parsePropertySearchQuery(queryText: string | undefined): ParsedPropertySearchQuery {
  const raw = (queryText || '').trim()
  if (!raw) {
    return { amenityTerms: [], textTokens: [] }
  }

  const qNorm = normalizeAccents(raw)
  let working = ` ${qNorm} `

  let roomsExact: number | undefined
  let bedroomsExact: number | undefined
  let bathroomsExact: number | undefined
  const extractedDigits = new Set<string>()

  const applyNumeric = (re: RegExp, setter: (n: number) => void) => {
    const m = working.match(re)
    if (m) {
      const n = Number(m[1])
      if (!Number.isNaN(n)) {
        setter(n)
        extractedDigits.add(String(n))
        working = working.replace(m[0], ' ')
      }
    }
  }

  applyNumeric(/(\d+)\s*(ambientes?|amb\.?)\b/i, (n) => {
    roomsExact = n
  })
  applyNumeric(/(\d+)\s*(rooms?)\b/i, (n) => {
    roomsExact = roomsExact ?? n
  })
  applyNumeric(
    /(\d+)\s*(bedrooms?|beds?|bed\b|dormitorios?|habitaciones?|brs?)\b/i,
    (n) => {
      bedroomsExact = n
    }
  )
  applyNumeric(
    /(\d+)\s*(baños?|banos?|baths?\b|bathrooms?)\b/i,
    (n) => {
      bathroomsExact = n
    }
  )
  applyNumeric(/(\d+)\s*br\b/i, (n) => {
    bedroomsExact = bedroomsExact ?? n
  })
  applyNumeric(/(\d+)br\b/i, (n) => {
    bedroomsExact = bedroomsExact ?? n
  })

  const amenityTerms = AMENITY_LEXICON.filter(({ test }) => test(qNorm)).map((x) => x.canonical)
  const uniqueAmenities = [...new Set(amenityTerms)]

  for (const { canonical } of AMENITY_LEXICON) {
    const strip = canonical.replace(/ /g, '\\s+')
    working = working.replace(new RegExp(`\\b(${strip})\\b`, 'gi'), ' ')
  }

  working = working.replace(/\s+/g, ' ').trim()

  const textTokens = tokenizeFreetext(working, extractedDigits)

  return {
    roomsExact,
    bedroomsExact,
    bathroomsExact,
    amenityTerms: uniqueAmenities,
    textTokens,
  }
}
