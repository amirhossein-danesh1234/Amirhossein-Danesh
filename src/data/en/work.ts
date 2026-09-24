export type WorkEntry = {
  organization: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
  responsibilities: string[];
  relatedProjects: string[];
  url: string;
  status: string;
};

export type WorkCaseStudy = {
  projectName: string;
  role: string;
  introduction: string;
  roleSummary: string;
  sections: {
    myRole: string;
    whatIDo: string;
    workingWithTeam: string;
    workflow: string;
    tools: string;
    artifacts: string;
    howIWork: string;
    outcomes: string;
    confidentiality: string;
  };
  workStreams: { title: string; summary: string; items: string[] }[];
  team: { description: string; collaborators: string[] };
  workflow: { description: string; steps: string[] };
  tools: { title: string; items: { name: string; description: string }[] }[];
  artifacts: { title: string; items: string[] }[];
  principles: { title: string; description: string }[];
  outcomes: string[];
  confidentialityNote: string;
};

export const work: WorkEntry[] = [{
  organization: 'Baazargaan',
  role: 'Co-founder · Product & Technical',
  startDate: '',
  endDate: '',
  description: 'I work across product, technology, and delivery on a digital B2B product in development.',
  responsibilities: ['Product', 'Technical Coordination', 'Startup Operations'],
  relatedProjects: [],
  url: '',
  status: 'In development',
}];

export const workCaseStudy: WorkCaseStudy = {
  projectName: 'Baazargaan',
  role: 'Co-founder · Product & Technical',
  introduction: 'A digital B2B product in development where I work across product, technology, and delivery. My role spans problem definition and product decisions through technical coordination, quality assurance, documentation, and release readiness.',
  roleSummary: 'My role connects product questions with the team’s technical work and delivery. I clarify problems, turn decisions into actionable requirements, and follow implementation and quality with the specialists doing the work. Progress comes through shared decisions and coordinated contributions across the team.',
  sections: {
    myRole: 'My role',
    whatIDo: 'What I do',
    workingWithTeam: 'Working across the team',
    workflow: 'From idea to delivery',
    tools: 'Tools I work with',
    artifacts: 'Artifacts I produce',
    howIWork: 'How I work',
    outcomes: 'Selected outcomes',
    confidentiality: 'Confidentiality',
  },
  workStreams: [
    {
      title: 'Product decisions',
      summary: 'I make open-ended product questions easier for the team to discuss, decide, and implement.',
      items: [
        'Turn early needs and ideas into product requirements, scenarios, and actionable decisions.',
        'Define and review product requirement documents and product rules.',
        'Break broad problems into smaller decisions and scopes.',
        'Prioritize features and make trade-offs visible.',
        'Coordinate roadmaps, backlogs, and dependencies.',
        'Define acceptance criteria and a clear definition of done.',
        'Review delivered work against product decisions.',
        'Keep current decisions as the shared source of truth across documentation.',
      ],
    },
    {
      title: 'Technical coordination',
      summary: 'I work at the boundary between product and development, with hands-on frontend work and close coordination with technical specialists.',
      items: [
        'Contribute hands-on to frontend work and UI iterations.',
        'Review interactions and user flows.',
        'Coordinate frontend and backend work with the development team.',
        'Review API and integration behavior against product expectations.',
        'Trace issues across the UI, backend, and data layers.',
        'Join debugging and investigate issues exposed during integration or QA.',
        'Review deployment and release state with the team.',
        'Translate technical constraints into clear product decisions.',
      ],
    },
    {
      title: 'Delivery, quality, and documentation',
      summary: 'I help keep decisions, implementation feedback, and release preparation connected throughout delivery.',
      items: [
        'Break decisions into tasks and map dependencies.',
        'Check implementation against acceptance criteria and definition of done.',
        'Contribute to QA checklists and follow-up iterations.',
        'Document product and technical issues so the team can resolve them together.',
        'Prepare release-readiness notes and keep project context up to date.',
      ],
    },
  ],
  team: {
    description: 'My work at Baazargaan is cross-functional and collaborative. I bring product decisions, technical constraints, implementation feedback, and delivery needs into the same conversation, then keep open questions moving among the people closest to them. Each area is built with the relevant specialists on the team.',
    collaborators: [
      'Backend development',
      'UI and interface work',
      'Product stakeholders',
      'Marketing and branding contributors',
      'Business stakeholders',
    ],
  },
  workflow: {
    description: 'My role can span several stages: clarify the problem, turn it into actionable work with the team, and follow the result through quality review and release preparation.',
    steps: [
      'Problem or idea',
      'Research and clarification',
      'Product decision',
      'Requirements, rules, and scenarios',
      'Task and dependency breakdown',
      'Design and technical coordination',
      'Team implementation',
      'QA and iteration',
      'Release readiness and review',
      'Documentation and next decisions',
    ],
  },
  tools: [
    {
      title: 'Product and documentation',
      items: [
        { name: 'Notion', description: 'Product decisions, tasks, documentation, and project context.' },
        { name: 'Figma', description: 'Interface reviews, flow walkthroughs, and design-development communication.' },
      ],
    },
    {
      title: 'Development and delivery',
      items: [
        { name: 'GitHub', description: 'Code, change history, and technical coordination.' },
        { name: 'Vercel', description: 'Deployment and release verification.' },
        { name: 'Codex', description: 'A supporting tool for code exploration and development work.' },
      ],
    },
  ],
  artifacts: [
    { title: 'Product', items: ['Product requirement documents', 'Product rules', 'User and system scenarios', 'Decision logs', 'Roadmaps', 'Prioritized backlogs', 'Acceptance criteria'] },
    { title: 'Delivery', items: ['Task breakdowns', 'Dependency maps', 'QA checklists', 'Release-readiness notes', 'Technical and product issue documentation'] },
    { title: 'Collaboration', items: ['UI review notes', 'Implementation feedback', 'Cross-functional decisions', 'Project documentation'] },
  ],
  principles: [
    { title: 'Clarity before execution', description: 'Before work starts, I help clarify the problem, who needs to decide, and what done means.' },
    { title: 'Trade-offs over perfect answers', description: 'I consider time, team capacity, and dependencies when evaluating product and technical choices.' },
    { title: 'Documentation as infrastructure', description: 'Important decisions and context belong in documentation the team can return to.' },
    { title: 'Team over individual heroics', description: 'I aim to build shared context and coordination that help the team work with greater independence.' },
  ],
  outcomes: [
    'Helped turn an early idea into a more structured product that the team can implement.',
    'Established clearer ways to document product decisions.',
    'Connected product needs with technical constraints and the team’s implementation work.',
    'Contributed to multiple UI and frontend iterations.',
    'Joined QA to identify mismatches between product decisions and implementation.',
    'Helped structure workflows for tasks, decisions, documentation, and release readiness.',
    'Moved project context from informal conversations into a shared source of truth.',
  ],
  confidentialityNote: 'Some product, business, and infrastructure details are intentionally not shared on this public page while the project is active.',
};
