import Head from 'next/head';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

export default function PrivacyPage() {
  const { theme } = useAuth();
  const c = getThemeColors(theme);
  const updated = '13 June 2026';

  return (
    <>
      <Head>
        <title>Privacy Policy — Lineup Mate</title>
      </Head>
      <Navbar />
      <main id="main-content" className="mobile-shell-padding mx-auto max-w-2xl px-4 py-10" style={{ minHeight: '100dvh', background: c.bg, color: c.txt }}>
        <article>
          <header className="mb-8">
            <h1 className="text-3xl font-black" style={{ fontFamily: 'Syne, Nunito, sans-serif' }}>Privacy Policy</h1>
            <p className="mt-1 text-sm" style={{ color: c.muted }}>Last updated: {updated}</p>
          </header>

          <div className="space-y-6 text-sm leading-relaxed" style={{ color: c.txt }}>
            <section>
              <h2 className="mb-2 text-lg font-black">1. Who we are</h2>
              <p>Lineup Mate is a festival schedule and group coordination app operated by Ben Shirom. Questions: <a href="mailto:support@lineupmate.app" className="underline" style={{ color: c.acc }}>support@lineupmate.app</a></p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-black">2. Data we collect</h2>
              <table className="w-full text-xs border-collapse" style={{ border: `1px solid ${c.brd}` }}>
                <thead>
                  <tr style={{ background: c.surf2 }}>
                    <th className="p-2 text-left font-black">Data</th>
                    <th className="p-2 text-left font-black">Why</th>
                    <th className="p-2 text-left font-black">Shared?</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Email address', 'Account management & login', 'No'],
                    ['Display name', 'Show your name in groups', 'No'],
                    ['Schedule picks & group data', 'Core app functionality', 'No'],
                    ['Push token (FCM / VAPID)', 'Sending notifications (if enabled)', 'No'],
                    ['Theme preference', 'Remember your display setting', 'No'],
                  ].map(([data, why, shared]) => (
                    <tr key={data} style={{ borderTop: `1px solid ${c.brd}` }}>
                      <td className="p-2">{data}</td>
                      <td className="p-2" style={{ color: c.muted }}>{why}</td>
                      <td className="p-2">{shared}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2" style={{ color: c.muted }}>We do not collect location, contacts, financial data, or browsing history.</p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-black">3. Where data is stored</h2>
              <p>All data is stored in <strong>Supabase</strong> (PostgreSQL database hosted on AWS). Data at rest and in transit is encrypted. Supabase infrastructure is located in the EU (Frankfurt region) by default.</p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-black">4. Third-party services</h2>
              <ul className="list-disc pl-5 space-y-1" style={{ color: c.muted }}>
                <li><strong style={{ color: c.txt }}>Supabase</strong> — database, authentication, storage</li>
                <li><strong style={{ color: c.txt }}>Firebase / Google FCM</strong> — push notifications on Android</li>
                <li><strong style={{ color: c.txt }}>Netlify</strong> — web hosting</li>
                <li><strong style={{ color: c.txt }}>Sentry</strong> — anonymous error reporting (no PII in error logs)</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-black">5. Your rights</h2>
              <p>You can at any time:</p>
              <ul className="mt-2 list-disc pl-5 space-y-1" style={{ color: c.muted }}>
                <li><strong style={{ color: c.txt }}>Export your data</strong> — Profile → Your Data → Export My Data</li>
                <li><strong style={{ color: c.txt }}>Delete your account</strong> — Profile → Your Data → Delete Account, or visit <Link href="/delete-account" className="underline" style={{ color: c.acc }}>/delete-account</Link></li>
                <li><strong style={{ color: c.txt }}>Correct your data</strong> — edit your display name in Profile</li>
                <li><strong style={{ color: c.txt }}>Contact us</strong> — <a href="mailto:support@lineupmate.app" className="underline" style={{ color: c.acc }}>support@lineupmate.app</a></li>
              </ul>
              <p className="mt-2">Account deletion is permanent and removes all your data from our systems.</p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-black">6. Data retention</h2>
              <p>Your data is kept as long as your account is active. After account deletion, data is removed immediately. Anonymous OTA update event logs are automatically purged after 30 days.</p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-black">7. Children</h2>
              <p>Lineup Mate is not directed at children under 13. We do not knowingly collect data from children.</p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-black">8. Changes</h2>
              <p>We will update this page if our practices change. Continued use after a change constitutes acceptance.</p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-black">9. Contact</h2>
              <p>Questions or requests: <a href="mailto:support@lineupmate.app" className="underline" style={{ color: c.acc }}>support@lineupmate.app</a></p>
            </section>
          </div>

          <footer className="mt-8 flex gap-4 text-xs" style={{ color: c.muted }}>
            <Link href="/terms" className="underline" style={{ color: c.acc }}>Terms of Service</Link>
            <Link href="/accessibility" className="underline" style={{ color: c.acc }}>Accessibility</Link>
          </footer>
        </article>
      </main>
    </>
  );
}
