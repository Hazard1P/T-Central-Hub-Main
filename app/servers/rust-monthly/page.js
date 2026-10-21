import ServerDirectoryPage from '@/components/ServerDirectoryPage';

export const metadata = { title: 'Community servers' };

export default function RustMonthlyPage() {
  return <ServerDirectoryPage initialGame="rust" />;
}
