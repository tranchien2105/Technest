export interface SeoOverride {
  title: string;
  description: string;
  socialImage: string;
  canonicalPath: string;
  noindex: boolean;
}
export interface SeoPage {
  status: number;
  redirect?: string;
  title: string;
  description: string;
  canonical: string | null;
  image: string | null;
  robots: string;
  type: string;
  schemas: Record<string, unknown>[];
  content: string;
  expiresAt?: string;
}
export interface SeoConfig {
  environment: string;
  siteUrl?: string | undefined;
  indexingEnabled: boolean;
  enforceOrigin?: boolean | undefined;
  proxyHops?: number | undefined;
  verification?: string | undefined;
}
