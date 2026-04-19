import Link from 'next/link';

const nodes = [
  { href: '/servers/arma3-cth', label: 'Arma3 CTH', style: { top: '22%', left: '26%' } },
  { href: '/servers/rust-vanilla', label: 'Rust Vanilla', style: { top: '70%', left: '42%' } },
  { href: '/donate', label: 'Support Hub', style: { top: '27%', left: '73%' } },
  { href: '/information', label: 'Information', style: { top: '77%', left: '76%' } },
  { href: '/about', label: 'About', style: { top: '16%', left: '58%' } },
  { href: '/contact', label: 'Contact', style: { top: '61%', left: '18%' } },
];

export default function CosmicMap() {
  return (
    <div className="cosmic-map procedural-cosmic-map">
      <div className="cosmic-image procedural-cosmic-surface">
        <div className="pcm-core" />
        <div className="pcm-orbit pcm-orbit-a" />
        <div className="pcm-orbit pcm-orbit-b" />
        <div className="pcm-orbit pcm-orbit-c" />
        <div className="pcm-stars" />
      </div>
      <div className="cosmic-overlay" />
      {nodes.map((node) => (
        <Link key={node.label} href={node.href} className="map-node" style={node.style}>
          <span className="map-node-dot" />
          <span className="map-node-label">{node.label}</span>
        </Link>
      ))}
      <div className="map-caption">
        <p className="eyebrow">Interactive navigation</p>
        <h3>Move through a generated observance field instead of static artwork.</h3>
      </div>
    </div>
  );
}
