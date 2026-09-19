import type { Locale } from './config';

export const messages = {
  en: {
    nav: { work: 'Work', projects: 'Projects', academic: 'Academic', skills: 'Skills', about: 'About', resume: 'Resume', language: 'FA' },
    labels: { personalHub: 'PERSONAL HUB', now: 'NOW', current: 'Current', studying: 'Studying', building: 'Building', exploring: 'Exploring', theme: 'Theme', switchToDark: 'Switch to dark mode', switchToLight: 'Switch to light mode', switchToPersian: 'Switch to Persian', switchToEnglish: 'Switch to English' },
    actions: { viewWork: 'View work', viewProjects: 'View projects', viewAcademic: 'View academic', viewSkills: 'View skills', aboutMe: 'About me', moreAbout: 'More about me' },
    home: {
      nowDescription: 'A short view of what is currently shaping my time.', workDescription: 'Product, startups and technical operations.', projectsDescription: 'A selection of things I have built or am building.', academicDescription: 'B.Sc. Physics', skillsDescription: 'Capabilities shaped by product, software, physics and operations.', aboutDescription: 'The intersection of physics, technology, product and entrepreneurship.',
    },
    pages: {
      about: { eyebrow: 'ABOUT', title: 'A work in progress, across disciplines.', description: 'Physics, technology, product and entrepreneurship are the threads I keep returning to.' },
      work: { eyebrow: 'WORK', title: 'Product and technical operations.', description: 'Selected professional work, kept concise and easy to extend.' },
      projects: { eyebrow: 'PROJECTS', title: 'Things I am building and exploring.', description: 'A small, evolving index of projects. More detail can be added as each project develops.' },
      academic: { eyebrow: 'ACADEMIC', description: 'Academic profile and current university context.' },
      skills: { eyebrow: 'SKILLS', title: 'Capabilities, without a scoreboard.', description: 'Areas of practice that connect product building, technical work, science and operations.' },
      resume: { eyebrow: 'RESUME', profile: 'Profile', work: 'Work', projects: 'Projects', academic: 'Academic', areas: 'Areas' },
    },
    academic: { university: 'University', coursework: 'Selected Coursework', activities: 'Academic Activities', research: 'Research Interests', events: 'Events' },
    footer: 'Resume',
  },
  fa: {
    nav: { work: 'کار', projects: 'پروژه‌ها', academic: 'دانشگاه', skills: 'توانمندی‌ها', about: 'درباره من', resume: 'رزومه', language: 'EN' },
    labels: { personalHub: 'نمایه شخصی', now: 'اکنون', current: 'فعلی', studying: 'در حال مطالعه', building: 'در حال ساخت', exploring: 'در حال بررسی', theme: 'پوسته', switchToDark: 'فعال‌سازی پوسته تاریک', switchToLight: 'فعال‌سازی پوسته روشن', switchToPersian: 'رفتن به فارسی', switchToEnglish: 'رفتن به انگلیسی' },
    actions: { viewWork: 'مشاهده تجربه کاری', viewProjects: 'مشاهده پروژه‌ها', viewAcademic: 'مشاهده بخش دانشگاه', viewSkills: 'مشاهده توانمندی‌ها', aboutMe: 'درباره من', moreAbout: 'بیشتر درباره من' },
    home: {
      nowDescription: 'نگاهی کوتاه به چیزهایی که اکنون زمان من را شکل می‌دهند.', workDescription: 'محصول، استارتاپ‌ها و عملیات فنی.', projectsDescription: 'گزیده‌ای از چیزهایی که ساخته‌ام یا در حال ساختنشان هستم.', academicDescription: 'کارشناسی فیزیک', skillsDescription: 'توانمندی‌هایی شکل‌گرفته از محصول، نرم‌افزار، فیزیک و عملیات.', aboutDescription: 'تقاطع فیزیک، فناوری، محصول و کارآفرینی.',
    },
    pages: {
      about: { eyebrow: 'درباره من', title: 'مسیر کاری در حال شکل‌گیری، میان چند حوزه.', description: 'فیزیک، فناوری، محصول و کارآفرینی رشته‌هایی هستند که همواره به آن‌ها بازمی‌گردم.' },
      work: { eyebrow: 'کار', title: 'محصول و عملیات فنی.', description: 'گزیده‌ای از تجربه کاری، کوتاه و آماده گسترش.' },
      projects: { eyebrow: 'پروژه‌ها', title: 'چیزهایی که می‌سازم و بررسی می‌کنم.', description: 'فهرستی کوچک و در حال رشد از پروژه‌ها. با پیشرفت هر پروژه می‌توان جزئیات بیشتری اضافه کرد.' },
      academic: { eyebrow: 'دانشگاه', description: 'نمایی از مسیر دانشگاهی و زمینه فعلی تحصیل.' },
      skills: { eyebrow: 'توانمندی‌ها', title: 'توانمندی‌ها، بدون امتیازدهی.', description: 'حوزه‌هایی که ساخت محصول، کار فنی، علم و عملیات را به هم پیوند می‌دهند.' },
      resume: { eyebrow: 'رزومه', profile: 'معرفی', work: 'تجربه کاری', projects: 'پروژه‌ها', academic: 'تحصیلات', areas: 'حوزه‌ها' },
    },
    academic: { university: 'دانشگاه', coursework: 'دروس منتخب', activities: 'فعالیت‌های دانشگاهی', research: 'علایق پژوهشی', events: 'رویدادها' },
    footer: 'رزومه',
  },
} as const;

export type Messages = (typeof messages)[Locale];
