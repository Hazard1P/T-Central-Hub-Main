import Image from 'next/image';

export default function BrandLogo() {
  return <span className="brand-lockup"><Image src="/brand/tcentral-mark.png" width={46} height={46} alt="" className="brand-mark" priority /><span className="brand-wordmark">T-CENTRAL<small>EXPLORE. CONNECT. CREATE.</small></span></span>;
}
