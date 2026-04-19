import ServerDetailStats from '@/components/ServerDetailStats';
import { getServerBySlug } from '@/lib/serverData';

export const metadata = { title: 'Rust Monthly' };

export default function RustMonthlyPage() {
  return <ServerDetailStats server={getServerBySlug('rust-monthly')} />;
}
