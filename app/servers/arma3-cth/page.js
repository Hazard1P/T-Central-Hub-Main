import ServerDirectoryPage from '@/components/ServerDirectoryPage';

export const metadata = { title: 'Arma 3 servers' };

export default function ArmaPage() {
  return <ServerDirectoryPage initialGame="arma3" />;
}
