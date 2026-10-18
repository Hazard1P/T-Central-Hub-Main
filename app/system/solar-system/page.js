import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function SolarSystemPage() { redirect('/system?region=solar&body=earth'); }
