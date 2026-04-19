import ServerDetailStats from '@/components/ServerDetailStats';
import { getServerBySlug } from '@/lib/serverData';

export const metadata = {
  title: 'Rust Vanilla',
  description: 'Official T-Central Rust Vanilla server page with direct connect details, wipe cadence, and map info.',
};

export default function RustPage() {
  return <ServerDetailStats server={getServerBySlug('rust-vanilla')} />;
}
