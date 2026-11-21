import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './styles.css';

export type HomeTheme = 'ration' | 'svod' | 'vault' | 'portfolio';

export function Shell({ theme, children, appearance = 'auto' }: {
  theme: HomeTheme;
  appearance?: 'auto' | 'light' | 'dark';
  children: ReactNode;
}) {
  return <div className="home-ui" data-home-theme={theme} data-home-appearance={appearance}>
    <a className="ui-skip" href="#content">К содержимому</a>
    {children}
  </div>;
}

export function AppHeader({ brand, navigation, actions }: {
  brand: ReactNode;
  navigation?: ReactNode;
  actions?: ReactNode;
}) {
  return <header className="ui-bar">
    <div className="ui-container ui-toolbar">
      <div className="ui-brand">{brand}</div>
      {navigation && <nav aria-label="Разделы" className="ui-nav">{navigation}</nav>}
      {actions && <div className="ui-actions">{actions}</div>}
    </div>
  </header>;
}

export function PageHeading({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return <div className="ui-page-heading"><h1>{children}</h1>{actions && <div className="ui-actions">{actions}</div>}</div>;
}

type ButtonKind = 'quiet' | 'secondary' | 'primary' | 'danger';
export function buttonClass(kind: ButtonKind = 'secondary') {
  return `ui-button ui-button--${kind}`;
}

export function Button({ kind = 'secondary', className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: ButtonKind }) {
  return <button className={`${buttonClass(kind)} ${className}`.trim()} type={type} {...props} />;
}

const iconPaths = {
  meal: 'M4 14a8 8 0 0 0 16 0M3 14h18M8 21h8M9 4c3 2-2 4 0 6M15 3c3 2-2 4 0 6',
  pencil: 'm4 16 12-12 4 4-12 12H4Zm9-9 4 4',
  chevron: 'm6 9 6 6 6-6',
  next: 'm9 6 6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M18 6 6 18',
  check: 'm5 12 4 4L19 6',
  trash: 'M4 6h16M6 6l1 14h10l1-14M9 6V3h6v3m-5 4v6m4-6v6',
  wallet: 'M4 5h15a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm12 5h4v5h-4a2.5 2.5 0 1 1 0-5Z',
  trend: 'm3 18 6-6 4 3 7-8m-6 0h6v6',
  stack: 'M3 4h8v7H3z M13 4h8v7h-8z M3 13h8v7H3z M13 13h8v7h-8z',
};
export function Icon({ name }: { name: keyof typeof iconPaths }) {
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={iconPaths[name]} /></svg>;
}
