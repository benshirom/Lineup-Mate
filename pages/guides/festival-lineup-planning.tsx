import Link from 'next/link';
import BrandHeading from '@/components/marketing/BrandHeading';
import Navbar from '@/components/Navbar';
import Seo from '@/components/Seo';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

const sections = [
  {
    title: 'Start with your must-see artists',
    body: 'Do not try to plan the whole festival at once. Pick the artists you really care about first, then build the rest of the day around them.'
  },
  {
    title: 'Check schedule clashes before the festival starts',
    body: 'The hardest choices happen when two artists overlap. A good plan highlights conflicts early so you can decide before you are already between stages.'
  },
  {
    title: 'Group the plan by day, not by hype',
    body: 'A festival lineup feels easier when each day has its own shortlist. This keeps your plan realistic and easier to follow on mobile.'
  },
  {
    title: 'Plan with your crew, but keep your own picks',
    body: 'Friends rarely want the exact same schedule. The best system lets everyone save their own artists while still seeing the shared group direction.'
  },
  {
    title: 'Leave room for discovery',
    body: 'A strong festival plan should not feel like a strict calendar. Save your anchors, notice conflicts, and leave space for spontaneous stage discoveries.'
  }
];

const guideStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How to plan a festival lineup with friends',
  description: 'A practical guide for planning a festival lineup, saving must-see artists, avoiding schedule clashes, and coordinating with friends on mobile.',
  author: {
    '@type': 'Organization',
    name: 'Lineup·Mate'
  },
  publisher: {
    '@type': 'Organization',
    name: 'Lineup·Mate'
  },
  mainEntityOfPage: 'https://lineup-mate.netlify.app/guides/festival-lineup-planning'
};

export default function FestivalLineupPlanningGuide() {
  const { theme } = useAuth();
  const c = getThemeColors(theme);

  return (
    <>
      <Seo
        title="How to plan a festival lineup with friends | Lineup·Mate Guide"
        description="A practical guide for planning a festival lineup, saving must-see artists, avoiding schedule clashes, and coordinating with friends on mobile."
        canonicalPath="/guides/festival-lineup-planning"
        structuredData={guideStructuredData}
      />
      <Navbar />
      <main className="mobile-shell-padding" style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
        <article className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
          <header className="mb-8">
            <Link href="/faq" className="text-sm font-bold hover:opacity-80" style={{ color: c.acc }}>← Back to FAQ</Link>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.18em]" style={{ color: c.accB }}>Festival planning guide</p>
            <BrandHeading as="h1" tight lineHeight={1} className="mt-2 text-4xl font-black sm:text-5xl">
              How to plan a festival lineup with less stress and better decisions.
            </BrandHeading>
            <p className="mt-4 text-base leading-relaxed" style={{ color: c.muted }}>
              A festival lineup can look simple from far away, but once there are multiple stages, overlapping sets, and friends pulling in different directions, the plan gets messy fast. This guide explains a cleaner way to build a lineup you can actually use on mobile.
            </p>
          </header>

          <div className="space-y-4">
            {sections.map((section, index) => (
              <section key={section.title} className="rounded-[24px] p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full text-sm font-black" style={{ background: `${index === 1 ? c.warning : index === 3 ? c.accB : c.acc}1f`, color: index === 1 ? c.warning : index === 3 ? c.accB : c.acc }}>
                  {index + 1}
                </div>
                <h2 className="text-xl font-black">{section.title}</h2>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: c.muted }}>{section.body}</p>
              </section>
            ))}
          </div>

          <section className="mt-8 rounded-[28px] p-6" style={{ background: `linear-gradient(135deg, ${c.surf}, ${c.surf2})`, border: `1px solid ${c.brd}` }}>
            <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: c.acc }}>Lineup·Mate approach</p>
            <BrandHeading className="mt-2 text-2xl font-black">
              The lineup is public. The plan is personal.
            </BrandHeading>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: c.muted }}>
              Use the public schedule as the source, then build your own saved artist list and crew plan on top of it.
            </p>
            <Link href="/#events" className="mt-5 inline-flex rounded-full px-5 py-3 text-sm font-black text-white" style={{ background: c.acc }}>
              Start with a festival
            </Link>
          </section>
        </article>
      </main>
    </>
  );
}
