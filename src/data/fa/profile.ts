import type { EmailContact, SocialLink } from '../en/profile';
export const profile = {
  name: 'امیرحسین دانش', title: 'دانشجوی فیزیک و علوم کامپیوتر · محصول و عملیات فنی', bio: 'در رشته فیزیک تحصیل می‌کنم و ماینور علوم کامپیوتر دارم؛ هم‌زمان در حوزه‌های محصول، هماهنگی فنی و عملیات استارتاپی فعالیت می‌کنم. مسیر بلندمدتم ساخت محصولات Deep-Tech در نقطه تلاقی علم، فناوری و کارآفرینی است.', location: '', profileImage: '/profile.jpeg',
  emails: [
    { type: 'academic', address: 'ar.dn@aut.ac.ir' },
    { type: 'personal', address: 'sahdanesh1385@gmail.com' },
  ] satisfies EmailContact[],
  socialLinks: [
    { label: 'گیت‌هاب', href: 'https://github.com/amirhossein-danesh1234', icon: 'github', external: true },
    { label: 'لینکدین', href: 'https://www.linkedin.com/in/seyed-amirhossein-danesh/', icon: 'linkedin', external: true },
    { label: 'تلگرام', href: 'https://t.me/AmirHossein_Danesh', icon: 'telegram', external: true },
    { label: 'ایمیل', href: '', icon: 'email' },
    { label: 'رزومه', href: '/fa/resume', icon: 'resume' },
  ] satisfies SocialLink[],
} as const;
