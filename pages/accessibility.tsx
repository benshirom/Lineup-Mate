import Head from 'next/head';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/AuthContext';
import { getThemeColors } from '@/lib/platform';

export default function AccessibilityPage() {
  const { theme } = useAuth();
  const c = getThemeColors(theme);
  const updated = '13 June 2026';

  return (
    <>
      <Head>
        <title>הצהרת נגישות — Lineup Mate</title>
      </Head>
      <Navbar />
      <main id="main-content" className="mobile-shell-padding mx-auto max-w-2xl px-4 py-10" style={{ minHeight: '100dvh', background: c.bg, color: c.txt }}>
        <article lang="he">
          <header className="mb-8">
            <h1 className="text-3xl font-black" style={{ fontFamily: 'Syne, Nunito, sans-serif' }}>הצהרת נגישות</h1>
            <p className="mt-1 text-sm" style={{ color: c.muted }}>עודכן לאחרונה: {updated}</p>
          </header>

          <div className="space-y-6 text-sm leading-relaxed" style={{ color: c.txt }}>
            <section>
              <h2 className="mb-2 text-lg font-black">רמת עמידה בתקן</h2>
              <p>
                Lineup Mate פועל לעמידה ב-<strong>WCAG 2.1 AA</strong> ובתקן הישראלי <strong>IS 5568</strong>.
                בדיקות אוטומטיות (axe-core) מופעלות על כל הדפים המרכזיים בכל גרסה.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-black">תכונות נגישות</h2>
              <ul className="list-disc pl-5 space-y-1" style={{ color: c.muted }}>
                <li>ניווט מקלדת מלא — Tab, Enter, Escape, חיצים</li>
                <li>מתאר פוקוס ברור על כל אלמנט אינטראקטיבי</li>
                <li>קישור &quot;דלג לתוכן הראשי&quot; בראש כל דף</li>
                <li>תגיות ARIA על כפתורי אייקון</li>
                <li>שגיאות טפסים מוכרזות למשתמשי קוראי מסך</li>
                <li>תמיכה ב-<code>prefers-reduced-motion</code> — אנימציות מופחתות</li>
                <li>מבנה HTML סמנטי עם landmarks (header, nav, main, footer)</li>
                <li>כיוון RTL מלא בעברית</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-black">רכיבים שטרם הונגשו במלואם</h2>
              <ul className="list-disc pl-5 space-y-1" style={{ color: c.muted }}>
                <li>מפת הליינאפ הוויזואלית — ניווט מקלדת מלא בפיתוח</li>
                <li>חלק מהדפי ניהול (admin) — פנימיים בלבד, לא נגישים לציבור</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-black">פנייה בעניין נגישות</h2>
              <p>
                גילית בעיית נגישות? נשמח לשמוע:{' '}
                <a href="mailto:support@lineupmate.app" className="underline" style={{ color: c.acc }}>
                  support@lineupmate.app
                </a>
              </p>
              <p className="mt-2" style={{ color: c.muted }}>
                נשתדל לטפל בפנייה תוך 14 ימי עסקים.
              </p>
            </section>
          </div>

          <footer className="mt-8 flex gap-4 text-xs" style={{ color: c.muted }}>
            <Link href="/privacy" className="underline" style={{ color: c.acc }}>מדיניות פרטיות</Link>
            <Link href="/terms" className="underline" style={{ color: c.acc }}>תנאי שימוש</Link>
          </footer>
        </article>
      </main>
    </>
  );
}
