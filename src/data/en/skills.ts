export type Capability = {
  title: string;
  summary: string;
  items: string[];
  description: string;
  evidenceNote?: string;
  evidence?: { label: string; href: string }[];
  featured?: boolean;
  compact?: boolean;
};

export type SkillTool = { name: string; description: string };
export type SkillToolGroup = { title: string; tools: SkillTool[] };
export type DevelopingArea = { title: string; description: string };
export type SkillGroup = { name: string; items: string[]; evidence: string[] };

export const capabilities: Capability[] = [
  {
    title: 'Product Thinking & Execution',
    summary: 'Turning ambiguous ideas and requirements into clearer product decisions and executable work.',
    items: [
      'Problem framing', 'Product requirements', 'PRDs and product rules', 'User and system scenarios',
      'Scope definition', 'Prioritization', 'Roadmap and backlog thinking', 'Acceptance criteria',
      'Dependency identification', 'Iterative product review',
    ],
    description:
      'I work from the problem toward an executable definition: clarifying requirements, identifying constraints and trade-offs, documenting decisions, and following the result through implementation and iteration.',
    evidenceNote: 'Used extensively in Baazargaan.',
    evidence: [{ label: 'See work', href: '/work' }],
    featured: true,
  },
  {
    title: 'Technical Coordination',
    summary: 'Working effectively at the boundary between product and software development.',
    items: [
      'Translating product requirements into technical conversations', 'Frontend implementation involvement',
      'UI and interaction review', 'Frontend–backend integration thinking',
      'API behavior review from a product perspective', 'Debugging and issue investigation',
      'Release and deployment verification', 'Technical constraint awareness',
      'Communicating implementation trade-offs',
    ],
    description:
      'I’m comfortable going into the technical details when a product decision depends on them. I can inspect implementations, investigate issues, contribute to frontend work, and coordinate with developers while keeping the product intent visible.',
    evidence: [
      { label: 'Baazargaan work', href: '/work' },
      { label: 'Projects', href: '/projects' },
    ],
    featured: true,
  },
  {
    title: 'Cross-functional Collaboration',
    summary: 'Connecting people, context, and decisions across different parts of a project.',
    items: [
      'Working with developers', 'Working with UI/design contributors', 'Aligning product and implementation',
      'Coordinating with business stakeholders', 'Giving and receiving implementation feedback',
      'Making dependencies visible', 'Maintaining shared context',
      'Turning conversations into documented decisions',
    ],
    description:
      'A significant part of my work happens between roles rather than inside a single discipline. I work with technical and non-technical teammates to clarify decisions, surface dependencies, review outcomes, and keep work moving.',
    evidence: [{ label: 'See work', href: '/work' }],
  },
  {
    title: 'Systems, Documentation & Operations',
    summary: 'Creating enough structure for complex work to remain understandable and executable.',
    items: [
      'Project structure', 'Task breakdown', 'Ownership and priorities', 'Decision logs',
      'Documentation systems', 'Source-of-truth thinking', 'Roadmap and milestone tracking',
      'QA workflows', 'Release/readiness tracking', 'Operational follow-through',
    ],
    description:
      'I care about reducing information loss between a decision and its execution. I use documentation, task structure, ownership, dependencies, and clear sources of truth to make projects easier to operate and revisit.',
    evidence: [{ label: 'See work', href: '/work' }],
  },
  {
    title: 'Analytical & Scientific Thinking',
    summary: 'A physics background shapes how I approach complex and uncertain problems.',
    items: [
      'Quantitative reasoning', 'Mathematical problem solving', 'Breaking complex systems into smaller components',
      'Working with assumptions and constraints', 'Comparing competing explanations',
      'Identifying inconsistencies', 'Evidence-oriented reasoning', 'Computational thinking',
    ],
    description:
      'Studying physics has trained me to be comfortable with abstraction, uncertainty, mathematical reasoning, and systems with many interacting variables. My computer science minor is extending that foundation toward algorithms and computation.',
    evidence: [{ label: 'Academic & research', href: '/academic' }],
  },
  {
    title: 'AI-assisted Work',
    summary: 'Using AI as a tool for analysis, research, implementation, and operational leverage.',
    items: [
      'Structured research with AI', 'Comparing options and trade-offs', 'Drafting and reviewing documentation',
      'Codebase exploration', 'Implementation assistance', 'QA assistance', 'Information synthesis',
      'Building repeatable AI-assisted workflows',
    ],
    description:
      'I use AI extensively, but not as a substitute for ownership or judgment. I use it to increase the amount of context I can process, test alternatives faster, assist implementation, and make repetitive work more systematic.',
    compact: true,
  },
];

export const toolGroups: SkillToolGroup[] = [
  {
    title: 'Product & Knowledge',
    tools: [
      { name: 'Notion', description: 'Product context, tasks, decisions, roadmaps and documentation.' },
      { name: 'Figma', description: 'UI review, flows and design-development communication.' },
    ],
  },
  {
    title: 'Development & Delivery',
    tools: [
      { name: 'GitHub', description: 'Code, version history and development collaboration.' },
      { name: 'Vercel', description: 'Deployment and release verification.' },
    ],
  },
  {
    title: 'AI',
    tools: [
      { name: 'ChatGPT / Codex', description: 'Research, analysis, implementation support, QA and structured workflows.' },
    ],
  },
];

export const developingAreas: DevelopingArea[] = [
  { title: 'Algorithms & Computer Science', description: 'Building a stronger formal foundation through my Computer Science minor.' },
  { title: 'Quantum Computing', description: 'Exploring the intersection of quantum physics, computation and algorithms.' },
  { title: 'Machine Learning', description: 'Developing the mathematical and computational foundations needed to use ML more rigorously.' },
  { title: 'Research Practice', description: 'Working toward a more formal research trajectory connecting physics and computation.' },
];

// Compact capability labels are also used by the existing resume summary.
export const skills: SkillGroup[] = capabilities.map((capability) => ({
  name: capability.title,
  items: capability.items,
  evidence: capability.evidence?.map((item) => item.href) ?? [],
}));
