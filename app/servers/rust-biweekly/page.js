import ServerDirectoryPage from '@/components/ServerDirectoryPage';

export const metadata = { title: 'Community servers' };

export default function RustBiweeklyPage() {
  return <ServerDirectoryPage initialGame="rust" />;
}
