import Link from 'next/link';
import HomeAccount from '@/components/HomeAccount';
import './home.css';

export const metadata = {
  title: { absolute: 'T-Central Hub — Explore beyond the familiar' },
  description: 'Launch into one continuous browser universe. Explore our Solar System and deep space, discover Rust and Arma 3 communities, and help shape T-Central.',
};

function Arrow({ diagonal = false }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? 'M6 18 18 6M6 6h12v12' : 'M4 12h15m-6-6 6 6-6 6'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function OrbitalScene() {
  return <div className="home-orbital-scene" role="img" aria-label="An artistic view of Earth surrounded by orbital paths and distant stars">
    <div className="home-orbit-halo" />
    <svg className="home-orbit-lines" viewBox="0 0 640 640" fill="none" aria-hidden="true">
      <circle cx="320" cy="320" r="281" stroke="currentColor" strokeOpacity=".17" strokeDasharray="2 10" />
      <circle cx="320" cy="320" r="225" stroke="currentColor" strokeOpacity=".12" />
      <ellipse cx="320" cy="320" rx="305" ry="112" transform="rotate(-32 320 320)" stroke="currentColor" strokeOpacity=".42" />
      <path d="M320 21v18m0 562v18M21 320h18m562 0h18" stroke="currentColor" strokeOpacity=".5" />
      <circle cx="565" cy="169" r="5" fill="#baf5df" /><circle cx="84" cy="470" r="3" fill="#baf5df" />
      <path d="M558 169h-48l-23-25M91 470h40l22 23" stroke="currentColor" strokeOpacity=".5" />
    </svg>
    <div className="home-earth" />
    <span className="home-orbit-label home-orbit-label--earth">SOL / 03 <strong>Earth</strong></span>
    <span className="home-orbit-label home-orbit-label--space">YOUR JOURNEY <strong>Starts here.</strong></span>
    <span className="home-scene-caption"><span /> One continuous universe</span>
  </div>;
}

const routes = [
  { number: '01', type: 'DISCOVER', title: 'Find your people.', text: 'Browse independent Rust and Arma 3 communities. Find a server, explore the details and join your next session.', href: '/server-info', action: 'Find a server', art: 'servers' },
  { number: '02', type: 'CONNECT', title: 'Build it with us.', text: 'Share a discovery, start a conversation or suggest what comes next. Your Steam or Google account connects you to the board.', href: '/hub-form', action: 'Join the community', art: 'community' },
  { number: '03', type: 'GET YOUR BEARINGS', title: 'A little direction.', text: 'New to the universe? Get familiar with flight controls, account features and the community before you head out.', href: '/information', action: 'Read the player guide', art: 'guide' },
];

export default function HomePage() {
  return <main className="home-page">
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-hero-stars" aria-hidden="true" />
      <div className="home-hero-inner">
        <div className="home-hero-copy">
          <p className="home-eyebrow"><span /> INDEPENDENT UNIVERSE. SHARED CURIOSITY.</p>
          <h1 id="home-title">Explore beyond<br />the <em>familiar.</em></h1>
          <p className="home-intro">Start close to home. See how far you go.</p>
          <p className="home-description">Fly through our Solar System and out into deep space. One continuous universe, right in your browser — with a community to discover along the way.</p>
          <div className="home-hero-actions">
            <Link className="home-launch" href="/system">Launch the universe <Arrow /></Link>
            <Link className="home-text-link" href="#find-your-orbit">Find your orbit <span aria-hidden="true">↓</span></Link>
          </div>
          <p className="home-play-note">Free to explore <span>·</span> No download <span>·</span> Desktop &amp; mobile</p>
        </div>
        <OrbitalScene />
      </div>
      <div className="home-flight-strip">
        <span className="home-flight-label">A UNIVERSE IN DEVELOPMENT</span>
        <p>Our Solar System <span aria-hidden="true">/</span> Black holes <span aria-hidden="true">/</span> Dyson spheres <span aria-hidden="true">/</span> Open exploration</p>
        <Link href="/status">Project status <Arrow diagonal /></Link>
      </div>
    </section>

    <section className="home-destinations home-container" id="find-your-orbit" aria-labelledby="home-orbit-title">
      <div className="home-section-heading"><div><p className="home-eyebrow">MORE THAN A DESTINATION</p><h2 id="home-orbit-title">Find your orbit.</h2></div><p>A place to explore, play and help shape<br className="home-desktop-break" /> what comes next.</p></div>
      <div className="home-route-grid">{routes.map((route) => <article className="home-route-card" key={route.number}>
        <div className={`home-route-art home-route-art--${route.art}`} aria-hidden="true"><span className="home-route-number">{route.number}</span><div className="home-route-symbol"><i /><i /><i /></div><span className="home-route-type">{route.type}</span></div>
        <div className="home-route-copy"><h3>{route.title}</h3><p>{route.text}</p><Link href={route.href}>{route.action} <Arrow diagonal /></Link></div>
      </article>)}</div>
    </section>

    <div className="home-container"><HomeAccount /></div>

    <section className="home-support home-container" aria-labelledby="home-support-title">
      <div className="home-support-mark" aria-hidden="true">✦</div>
      <div><p className="home-eyebrow">INDEPENDENT. COMMUNITY SUPPORTED.</p><h2 id="home-support-title">Help the next chapter take flight.</h2><p>Voluntary support keeps development, marketing and project hardware moving. Playing and taking part stay free.</p></div>
      <Link href="/donate" className="home-support-link">Support the project <Arrow diagonal /></Link>
    </section>
  </main>;
}
