// Planned guided stories (titles from the brief). Deks describe the question each
// story will examine; they make no factual claims about results.

export interface StoryMeta {
  slug: string;
  title: string;
  dek: string;
}

export const STORIES: StoryMeta[] = [
  {
    slug: 'rocket-docket',
    title: 'The Rocket Docket',
    dek: 'How quickly the Eastern District of Virginia moves its cases, measured against every other district.',
  },
  {
    slug: 'patent-capital',
    title: 'How Texas Became the Patent Capital, and What Happened After TC Heartland',
    dek: 'Where patent suits were filed before and after the Supreme Court’s 2017 venue decision.',
  },
  {
    slug: 'border-districts',
    title: 'The Border Districts',
    dek: 'What the caseloads of the districts along the southwest border look like, and how they differ from the rest.',
  },
  {
    slug: 'after-booker',
    title: 'After Booker: How Far Judges Stray from the Guidelines',
    dek: 'Sentences within, above and below the guideline range, district by district, since the Guidelines became advisory.',
  },
  {
    slug: 'where-trials-went',
    title: 'Where Trials Went',
    dek: 'How often federal cases end in a trial, and how that has changed over time.',
  },
];
