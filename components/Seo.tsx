import Head from 'next/head';

interface SeoProps {
  title?: string;
  description?: string;
  canonicalPath?: string;
  image?: string;
}

const SITE_URL = 'https://lineup-mate.netlify.app';
const DEFAULT_TITLE = 'Lineup·Mate — Plan your festival schedule with your crew';
const DEFAULT_DESCRIPTION = 'Explore festival lineups, save must-see artists, avoid time clashes, and coordinate plans with friends in one mobile-first festival planner.';
const DEFAULT_IMAGE = `${SITE_URL}/og-lineup-mate.png`;

export default function Seo({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  canonicalPath = '/',
  image = DEFAULT_IMAGE,
}: SeoProps) {
  const canonical = `${SITE_URL}${canonicalPath}`;

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="theme-color" content="#080B12" />
    </Head>
  );
}
