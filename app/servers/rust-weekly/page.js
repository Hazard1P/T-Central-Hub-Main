import ServerDetailStats from '@/components/ServerDetailStats';
import { getServerBySlug } from '@/lib/serverData';

export const metadata = { title: 'Rust Weekly' };

export default function RustWeeklyPage() {
  return <ServerDetailStats server={getServerBySlug('rust-weekly')} />;
}
