import Head from 'next/head';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

export default function TermsPage() {
  const { theme } = useAuth();
  const c = getThemeColors(theme);
  const updated = '13 June 2026';

  return (
    <>
      <Head>
        <title>Terms of Service — Lineup Mate</title>
      </Head>
      <Navbar />
      <main id="main-content" className="mobile-shell-padding mx-auto max-w-2xl px-4 py-10" style={{ minHeight: '100dvh', background: c.bg, color: c.txt }}>
        <article>
          <header className="mb-8">
            <h1 className="text-3xl font-black" style={{ fontFamily: 'Syne, Nunito, sans-serif' }}>Terms of Service</h1>
            <p className="mt-1 text-sm" style={{ color: c.muted }}>Last updated: {updated}</p>
          </header>

          <div className="space-y-6 text-sm leading-relaxed" style={{ color: c.txt }}>
            <section>
              <h2 className="mb-2 text-lg font-black">1. Acceptance</h2>
              <p>By using Lineup Mate you agree to these terms. If you do not agree, do not use the app.</p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-black">2. What Lineup Mate is</h2>
              <p>Lineup Mate is a free tool for planning your festival schedule and coordinating with friends. It is not affiliated with any festival organizer.</p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-black">3. Your account</h2>
              <ul className="list-disc pl-5 space-y-1" style={{ color: c.muted }}>
                <li>You must be at least 13 years old to create an account.</li>
                <li>You are responsible for keeping your login credentials secure.</li>
                <li>You may delete your account at any time from the Profile page.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-black">4. User-generated content</h2>
              <p>You may create group names and other content (&quot;<strong>UGC</strong>&quot;) within the app.</p>
              <ul className="mt-2 list-disc pl-5 space-y-1" style={{ color: c.muted }}>
                <li>You agree not to post content that is illegal, hateful, harassing, or sexually explicit.</li>
                <li>We may remove content or suspend accounts that violate these rules.</li>
                <li>To report inappropriate content, email <a href="mailto:support@lineupmate.app" className="underline" style={{ color: c.acc }}>support@lineupmate.app</a></li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-black">5. Availability</h2>
              <p>Lineup Mate is provided &quot;as is&quot;. We do not guarantee uninterrupted availability and may change or discontinue features at any time.</p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-black">6. Limitation of liability</h2>
              <p>To the extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from your use of the app.</p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-black">7. Changes</h2>
              <p>We may update these terms. Continued use after changes constitutes acceptance of the new terms.</p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-black">8. Contact</h2>
              <p><a href="mailto:support@lineupmate.app" className="underline" style={{ color: c.acc }}>support@lineupmate.app</a></p>
            </section>
          </div>

          <footer className="mt-8 flex gap-4 text-xs" style={{ color: c.muted }}>
            <Link href="/privacy" className="underline" style={{ color: c.acc }}>Privacy Policy</Link>
            <Link href="/accessibility" className="underline" style={{ color: c.acc }}>Accessibility</Link>
          </footer>
        </article>
      </main>
    </>
  );
}
