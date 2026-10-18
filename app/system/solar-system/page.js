import SolarSystemExplorer from '@/components/SolarSystemExplorer';

export const metadata = {
  title: 'Our Solar System',
  description: 'Explore the Sun, eight planets, Earth’s Moon and Pluto with calculated orbital positions, real-time UTC, physical scale and a geostationary Earth orbit.',
};

export default function SolarSystemPage() { return <SolarSystemExplorer />; }
