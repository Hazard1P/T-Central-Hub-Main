import ServerDirectoryPage from '@/components/ServerDirectoryPage';

export const metadata = { title: 'Community servers' };

export default function RustWeeklyPage() {
  return <ServerDirectoryPage initialGame="rust" />;
}
