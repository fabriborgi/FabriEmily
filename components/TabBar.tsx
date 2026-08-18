'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from '@/app/shell.module.css';

const TABS = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/games', label: 'Games', icon: '🎲' },
  { href: '/letters', label: 'Letters', icon: '✉️' },
  { href: '/pets', label: 'Pets', icon: '🐨' },
  { href: '/questions', label: 'Questions', icon: '💬' },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className={styles.tabbar} aria-label="Sections">
      {TABS.map((tab) => {
        const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={styles.tab}
            aria-current={active ? 'page' : undefined}
          >
            <span aria-hidden>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
