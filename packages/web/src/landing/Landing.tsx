import { useEffect } from 'react';
import { Layers } from 'lucide-react';
import { MARK_DEFS } from '@slabs/render';
import { SignInTrigger } from '@/auth';
import { Button } from '@/components/ui/button';
import { lang, nf, s, setLang } from '@/i18n';
import { useLang } from '@/i18n/useLang';
import { cn } from '@/lib/utils';
import { ART, type ArtPlate } from './art.generated';
import { LiveWall } from './LiveWall';

/** The Google "G" (four colours, as Google's sign-in button guidelines ask). */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/** The one action of the page: sign in with Google (Clerk's modal). */
function SignInCta({ onBlue = false }: { onBlue?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <SignInTrigger>
        <Button
          data-a="sign-in"
          className={cn('h-12 gap-3 px-5 text-base', onBlue && 'bg-card text-foreground hover:bg-card/90')}
        >
          <span className="grid size-6 place-items-center rounded-full bg-card"><GoogleG className="size-4" /></span>
          {s.landing.cta}
        </Button>
      </SignInTrigger>
      <span className={cn('text-base font-medium', onBlue ? 'text-primary-foreground' : 'text-foreground')}>{s.landing.free}</span>
      {!onBlue && <p className="basis-full max-w-[44ch] text-sm leading-snug text-muted-foreground">{s.landing.accountWhy}</p>}
    </div>
  );
}

function LangSwitch({ className }: { className?: string }) {
  const cur = useLang();
  return (
    <div role="group" aria-label={s.landing.langLabel} className={cn('inline-flex rounded-lg border bg-card p-0.5', className)}>
      {(['pl', 'en'] as const).map((l) => (
        <button
          key={l} type="button" lang={l} aria-pressed={cur === l} data-lang={l} onClick={() => setLang(l)}
          className={cn('min-h-11 min-w-11 rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2', cur === l ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent')}
        >
          {l === 'pl' ? 'PL' : 'EN'}
        </button>
      ))}
    </div>
  );
}

/** A plate drawing of the app, inlined so the theme colours apply. */
function Plate({ a, label }: { a: ArtPlate; label: string }) {
  return <svg viewBox={`0 0 ${a.w} ${a.h}`} role="img" aria-label={label} className="block h-auto w-full min-w-[560px]" dangerouslySetInnerHTML={{ __html: a.svg }} />;
}

function Section({ id, title, text, flip, children }: { id: string; title: string; text: string; flip?: boolean; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mx-auto grid w-full max-w-[1200px] items-center gap-x-12 gap-y-6 px-4 py-14 sm:px-6 md:py-20 grid-cols-[minmax(0,1fr)] lg:grid-cols-12">
      <div className={cn('flex flex-col gap-3 lg:col-span-4', flip ? 'lg:order-2 lg:col-start-9' : 'lg:col-start-1')}>
        <h2 id={id} className="text-balance text-[clamp(1.6rem,3vw,2.25rem)] font-semibold leading-tight tracking-tight">{title}</h2>
        <p className="max-w-[48ch] text-base leading-relaxed text-muted-foreground">{text}</p>
      </div>
      <div className={cn('lg:col-span-8', flip ? 'lg:order-1 lg:col-start-1' : 'lg:col-start-5')}>{children}</div>
    </section>
  );
}

const Figure = ({ children, caption }: { children: React.ReactNode; caption: string }) => (
  <figure className="flex flex-col gap-2">
    <div className="overflow-x-auto rounded-xl border bg-card p-2 sm:p-3" tabIndex={0} role="group" aria-label={caption}>{children}</div>
    <figcaption className="max-w-[66ch] text-[13px] leading-snug text-muted-foreground">{caption}</figcaption>
  </figure>
);

/** What the PDF page shows: the plate drawing and the list of its pieces (real data of an example plate). */
function SheetPage({ a }: { a: ArtPlate }) {
  const t = s.landing.sheets;
  return (
    <figure className="flex flex-col gap-2">
      <div className="mx-auto w-full max-w-[860px] rounded-md border bg-card p-4 shadow-sm sm:p-6" data-sheet>
        <div className="mb-3 flex items-baseline justify-between gap-3 border-b pb-2 text-sm">
          <span className="font-semibold">Slabs</span>
          <span className="text-muted-foreground">{t.page(a.no + 1, a.of + 1)}</span>
        </div>
        <div className="overflow-x-auto" tabIndex={0} role="group" aria-label={t.figure}><Plate a={a} label={t.alt} /></div>
        <table className="mt-4 w-full text-left text-sm">
          <caption className="pb-1 text-left text-[13px] font-semibold">{t.pieces}</caption>
          <tbody>
            {a.rows.slice(0, 5).map((r) => (
              <tr key={r.label} className="border-t">
                <th scope="row" className="py-1.5 pr-3 font-semibold">{r.label}</th>
                <td className="py-1.5 pr-3 tabular-nums">{nf(r.l, 1)} × {nf(r.w, 1)} cm</td>
                <td className="py-1.5 text-muted-foreground">{r.slanted ? t.slant : r.sliver ? t.sliver : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="max-w-[66ch] text-[13px] leading-snug text-muted-foreground">{t.figure}</figcaption>
    </figure>
  );
}

export default function Landing() {
  useLang();
  const art = ART[lang];
  const L = s.landing;
  useEffect(() => { // the same theme rule as the app: the saved choice, else the system's
    let saved: string | null = null;
    try { saved = localStorage.getItem('slabs-theme'); } catch { /* ignore */ }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', saved === 'dark' || (saved !== 'light' && mq.matches));
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  useEffect(() => {
    document.title = L.docTitle;
    document.documentElement.lang = lang;
    let m = document.querySelector('meta[name=description]');
    if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'description'); document.head.appendChild(m); }
    m.setAttribute('content', L.metaDescription);
  }, [L, lang]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: MARK_DEFS }} />
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-background" href="#main">{s.bar.skip}</a>
      <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-4 pt-4 sm:px-6">
        <a href="./" className="flex min-h-11 items-center gap-2 text-lg font-semibold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md" aria-label={L.home}>
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Layers className="size-4" aria-hidden="true" /></span>Slabs
        </a>
        <LangSwitch />
      </header>
      <main id="main">
        <div className="mx-auto grid w-full max-w-[1200px] items-center gap-x-12 gap-y-8 px-4 pb-14 pt-10 sm:px-6 md:pt-16 grid-cols-[minmax(0,1fr)] lg:grid-cols-12 lg:pb-20">
          <div className="flex flex-col gap-6 lg:col-span-5">
            <h1 className="text-balance text-[clamp(2.1rem,4.4vw,3.4rem)] font-semibold leading-[1.04] tracking-tight">{L.headline}</h1>
            <p className="max-w-[44ch] text-lg leading-relaxed text-muted-foreground">{L.lead}</p>
            <SignInCta />
          </div>
          <div className="lg:col-span-7"><LiveWall /></div>
        </div>

        <Section id="rooms-h" title={L.rooms.title} text={L.rooms.text}>
          <Figure caption={L.rooms.figure(art.together.no, art.plates)}><Plate a={art.together} label={L.rooms.alt} /></Figure>
        </Section>
        <Section id="material-h" title={L.material.title} text={L.material.text} flip>
          <Figure caption={L.material.figure(art.grooves.no, art.plates)}><Plate a={art.grooves} label={L.material.alt} /></Figure>
        </Section>
        <Section id="sheets-h" title={L.sheets.title} text={L.sheets.text}>
          <SheetPage a={art.sheet} />
        </Section>

        <section aria-labelledby="closing-h" className="bg-primary text-primary-foreground">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-16 sm:px-6 md:py-24">
            <h2 id="closing-h" className="max-w-[20ch] text-balance text-[clamp(2rem,4.4vw,3.25rem)] font-semibold leading-[1.08] tracking-tight">{L.closing.title}</h2>
            <p className="max-w-[52ch] text-lg leading-relaxed">{L.closing.text}</p>
            <SignInCta onBlue />
          </div>
        </section>
      </main>
      <footer className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-4 py-6 sm:px-6">
        <span className="flex items-center gap-2 text-sm font-semibold"><Layers className="size-4" aria-hidden="true" />Slabs</span>
        <LangSwitch />
      </footer>
    </div>
  );
}
