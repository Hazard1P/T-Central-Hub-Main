import ServerDirectoryPage from '@/components/ServerDirectoryPage';

export const metadata = { title: 'Community servers' };

export default function RustVanillaPage() {
  return <ServerDirectoryPage initialGame="rust" />;
}
