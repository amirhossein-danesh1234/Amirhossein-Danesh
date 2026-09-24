export type SocialIconName = 'github' | 'linkedin' | 'telegram' | 'email' | 'resume';
export type SocialLink = { label: string; href: string; icon: SocialIconName; external?: boolean };
export type EmailContact = { type: 'academic' | 'personal'; address: string };

export const profile = {
  name: 'AmirHossein Danesh',
  title: 'Physics & Computer Science Student · Product & Technical Operations',
  bio: 'I study physics with a minor in computer science and work across product, technical coordination, and startup operations. My long-term direction is to build deep-tech products at the intersection of science, technology, and entrepreneurship.',
  location: '', profileImage: '/profile.jpeg',
  emails: [
    { type: 'academic', address: 'ar.dn@aut.ac.ir' },
    { type: 'personal', address: 'sahdanesh1385@gmail.com' },
  ] satisfies EmailContact[],
  socialLinks: [
    { label: 'GitHub', href: 'https://github.com/amirhossein-danesh1234', icon: 'github', external: true },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/seyed-amirhossein-danesh/', icon: 'linkedin', external: true },
    { label: 'Telegram', href: 'https://t.me/AmirHossein_Danesh', icon: 'telegram', external: true },
    { label: 'Email', href: '', icon: 'email' },
    { label: 'CV', href: '/resume', icon: 'resume' },
  ] satisfies SocialLink[],
} as const;
