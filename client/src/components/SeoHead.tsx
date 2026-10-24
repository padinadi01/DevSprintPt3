import { useEffect } from 'react';

export interface SeoHeadProps {
  title: string;
  description?: string;
  noindex?: boolean;
  canonical?: string;
}

export function SeoHead({
  title,
  description = 'Sistem informasi manajemen stok, kasir penjualan (POS), dan pengadaan barang Warung Madura 24 Jam.',
  noindex = false,
  canonical,
}: SeoHeadProps) {
  useEffect(() => {
    // 1. Update Title
    const formattedTitle = title.includes('Warung Madura')
      ? title
      : `${title} | Warung Madura Stock Manager`;
    document.title = formattedTitle;

    // 2. Update or create meta[name="description"]
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', description);

    // 3. Update or create meta[name="robots"]
    let metaRobots = document.querySelector('meta[name="robots"]');
    if (!metaRobots) {
      metaRobots = document.createElement('meta');
      metaRobots.setAttribute('name', 'robots');
      document.head.appendChild(metaRobots);
    }
    metaRobots.setAttribute(
      'content',
      noindex ? 'noindex, nofollow, noarchive' : 'index, follow'
    );

    // 4. Update canonical link if provided
    if (canonical) {
      let linkCanonical = document.querySelector('link[rel="canonical"]');
      if (!linkCanonical) {
        linkCanonical = document.createElement('link');
        linkCanonical.setAttribute('rel', 'canonical');
        document.head.appendChild(linkCanonical);
      }
      linkCanonical.setAttribute('href', canonical);
    }

    // 5. Update Open Graph tags
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', formattedTitle);
    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', description);
  }, [title, description, noindex, canonical]);

  return null;
}
