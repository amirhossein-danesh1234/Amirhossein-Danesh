import type { SocialLink } from '../en/profile';
export const profile = {
  name: 'AmirHossein Danesh', title: 'دانشجوی فیزیک · محصول و عملیات فنی', bio: 'در رشته فیزیک تحصیل می‌کنم و در حوزه‌های محصول، نرم‌افزار و عملیات فنی فعالیت دارم؛ با علاقه‌ای بلندمدت به فناوری عمیق و کارآفرینی.', location: '', profileImage: '/profile-placeholder.svg',
  socialLinks: [{ label: 'گیت‌هاب', href: 'https://github.com/amirhossein-danesh1234', external: true }, { label: 'لینکدین', href: '', external: true }, { label: 'تلگرام', href: '', external: true }, { label: 'ایمیل', href: '', external: false }, { label: 'رزومه', href: '/fa/resume', external: false }] satisfies SocialLink[],
} as const;
