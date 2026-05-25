export interface ListingCheckResult {
  verified: boolean;
  score: number;
  reason?: string;
}

export interface ListingPhotosCheckResult extends ListingCheckResult {
  passed: number;
  total: number;
  distinctDimensions: number;
}

export interface ListingVerificationReport {
  verified: boolean;
  score: number;
  failures: string[];
  checks: {
    ownerDni: ListingCheckResult;
    contract: ListingCheckResult;
    photos: ListingPhotosCheckResult;
    videoTour: ListingCheckResult;
    location: ListingCheckResult;
  };
}

export interface ListingVerificationInput {
  images: string[];
  ownerDniDocumentUrl: string;
  contractOrTitleUrl: string;
  videoTourUrl: string;
  latitude?: number | null;
  longitude?: number | null;
  location?: string;
}
