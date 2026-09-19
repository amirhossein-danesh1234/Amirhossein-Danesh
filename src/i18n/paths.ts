import type { Locale } from './config';

export const toLocalizedPath = (locale: Locale, route: string): string => {
  const cleanRoute = route === '/' ? '' : route.replace(/^\//, '');
  return locale === 'en' ? (cleanRoute ? `/${cleanRoute}` : '/') : (cleanRoute ? `/fa/${cleanRoute}` : '/fa');
};

export const routeWithoutLocale = (pathname: string): string => {
  if (pathname === '/fa' || pathname === '/fa/') return '/';
  return pathname.replace(/^\/fa(?=\/|$)/, '') || '/';
};

export const alternatePath = (locale: Locale, pathname: string): string =>
  toLocalizedPath(locale === 'en' ? 'fa' : 'en', routeWithoutLocale(pathname));
