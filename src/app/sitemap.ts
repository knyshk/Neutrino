import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://neutrino.app', lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
    { url: 'https://neutrino.app/login', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.8 },
    { url: 'https://neutrino.app/signup', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.8 },
  ]
}
