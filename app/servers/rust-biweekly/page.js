import ServerDetailStats from '@/components/ServerDetailStats';
import { getServerBySlug } from '@/lib/serverData';

export const metadata = { title: 'Rust Bi-Weekly' };

export default function RustBiweeklyPage() {
  return <ServerDetailStats server={getServerBySlug('rust-biweekly')} />;
}
