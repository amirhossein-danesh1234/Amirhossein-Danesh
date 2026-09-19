export type SocialLink = {
  label: string;
  href: string;
  external?: boolean;
};

export const profile = {
  name: 'AmirHossein Danesh',
  title: 'Physics Student · Product & Technical Operations',
  bio: 'I study physics and work across product, software, and technical operations, with a long-term interest in deep-tech and entrepreneurship.',
  location: '',
  profileImage: '/profile-placeholder.svg',
  socialLinks: [
    { label: 'GitHub', href: 'https://github.com/amirhossein-danesh1234', external: true },
    { label: 'LinkedIn', href: '', external: true },
    { label: 'Telegram', href: '', external: true },
    { label: 'Email', href: '', external: false },
    { label: 'CV', href: '/resume', external: false },
  ] satisfies SocialLink[],
} as const;
