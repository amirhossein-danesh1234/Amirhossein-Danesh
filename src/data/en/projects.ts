export type Project = { title: string; slug: string; description: string; role: string; year: string; status: string; categories: string[]; technologies: string[]; githubUrl: string; externalUrl: string; featured: boolean };
export const projects: Project[] = [
  { title: 'Baazargaan', slug: 'baazargaan', description: 'A B2B platform connecting businesses with providers of foreign-trade services.', role: 'Product · Technical Coordination · Operations', year: '', status: 'Active', categories: [], technologies: [], githubUrl: '', externalUrl: '', featured: true },
  { title: 'Physics Workspace', slug: 'physics-workspace', description: '', role: '', year: '', status: '', categories: [], technologies: [], githubUrl: '', externalUrl: '', featured: false },
  { title: 'MeGloves', slug: 'megloves', description: 'A web project developed for a business in the industrial safety and glove sector.', role: '', year: '', status: 'Completed', categories: [], technologies: [], githubUrl: '', externalUrl: '', featured: true },
];
