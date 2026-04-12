/**
 * Prismatic — Confidence Page (Redirect)
 * Now integrated into /personas — this page redirects there
 */
import { redirect } from 'next/navigation';

export default function ConfidencePage() {
  redirect('/personas');
}
