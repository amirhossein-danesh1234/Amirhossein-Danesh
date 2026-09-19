export type Project = {
  title: string;
  slug: string;
  description: string;
  role: string;
  year: string;
  status: string;
  categories: string[];
  technologies: string[];
  githubUrl: string;
  externalUrl: string;
  featured: boolean;
};

export const projects: Project[] = [
  { title: 'Baazargaan', slug: 'baazargaan', description: '', role: '', year: '', status: '', categories: [], technologies: [], githubUrl: '', externalUrl: '', featured: true },
  { title: 'Physics Workspace', slug: 'physics-workspace', description: '', role: '', year: '', status: '', categories: [], technologies: [], githubUrl: '', externalUrl: '', featured: false },
  { title: 'MeGloves', slug: 'megloves', description: '', role: '', year: '', status: '', categories: [], technologies: [], githubUrl: '', externalUrl: '', featured: false },
];
