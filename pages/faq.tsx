import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Seo from '@/components/Seo';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

const faqs = [
  {
    question: 'What is Lineup·Mate?',
    answer: 'Lineup·Mate is a mobile-first festival planner that helps you explore lineups, save must-see artists, notice schedule clashes, and coordinate plans with friends.'
  },
  {
    question: 'Is Lineup·Mate a replacement for Clashfinder?',
    answer: 'No. Clashfinder is great for publishing and reading schedules. Lineup·Mate is the planning layer on top: personal picks, crew planning, and a cleaner mobile experience.'
  },
  {
    question: 'Can I use it without creating an account?',
    answer: 'Yes. You can browse festivals and schedules without an account. You only need to sign in when you want to save festivals, save artists, or create and join groups.'
  },
  {
    question: 'What is Crew Mode?',
    answer: 'Crew Mode lets you create a shared group around a festival so friends can compare plans and decide where to go together.'
  },
  {
    question: 'Does it work well on mobile?',
    answer: 'Yes. The product is designed mobile-first because most festival planning happens while moving between stages.'
  },
  {
    question: 'Which festivals are supported?',
    answer: 'The app supports festivals that have been added to Lineup·Mate. Admin tools can import and sync schedule data from supported sources.'
  }
];

export default function FaqPage() {
  const { theme } = useAuth();
  const c = getThemeColors(theme);

  return (
    <>
      <Seo
        title="Lineup·Mate FAQ — Festival planner questions"
        description="Answers about Lineup·Mate, mobile festival planning, saving artists, avoiding schedule clashes, and planning festival lineups with friends."
        canonicalPath="/faq"
      />
      <Navbar />
      <main className="mobile-shell-padding" style={{ minHeight: '100vh', background: c.bg, color: c.txt }}>
        <section className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
          <div className="mb-8">
            <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: c.accB }}>FAQ</p>
            <h1 className="mt-2 text-4xl font-black sm:text-5xl" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif', letterSpacing: '-0.04em' }}>
              Festival planning, explained clearly.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: c.muted }}>
              Everything a new user should understand before building a lineup, saving artists, or planning with a crew.
            </p>
          </div>

          <div className="mb-6 rounded-[28px] p-5" style={{ background: `linear-gradient(135deg, ${c.surf}, ${c.surf2})`, border: `1px solid ${c.brd}` }}>
            <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: c.acc }}>Guide</p>
            <h2 className="mt-2 text-2xl font-black" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>Need a better way to plan the lineup?</h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: c.muted }}>
              Read the practical planning guide before you start saving artists and coordinating with friends.
            </p>
            <Link href="/guides/festival-lineup-planning" className="mt-4 inline-flex rounded-full px-5 py-3 text-sm font-black text-white" style={{ background: c.acc }}>
              Read the planning guide
            </Link>
          </div>

          <div className="space-y-3" data-testid="faq-list">
            {faqs.map((faq) => (
              <article key={faq.question} className="rounded-[24px] p-5" style={{ background: c.surf, border: `1px solid ${c.brd}` }}>
                <h2 className="text-lg font-black">{faq.question}</h2>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: c.muted }}>{faq.answer}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-[28px] p-5 sm:p-6" style={{ background: `linear-gradient(135deg, ${c.surf}, ${c.surf2})`, border: `1px solid ${c.brd}` }}>
            <h2 className="text-2xl font-black" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>Ready to build your lineup?</h2>
            <p className="mt-2 text-sm" style={{ color: c.muted }}>Start from the festival list, pick your must-see artists, and bring your crew into the plan.</p>
            <Link href="/#events" className="mt-4 inline-flex rounded-full px-5 py-3 text-sm font-black text-white" style={{ background: c.acc }}>
              Choose a festival
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
