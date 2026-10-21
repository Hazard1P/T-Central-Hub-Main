import ServerDirectoryPage from '@/components/ServerDirectoryPage';

export default function ServerDetailStats({ server }) {
  return <ServerDirectoryPage initialGame={server?.family === 'arma' ? 'arma3' : 'rust'} />;
}
