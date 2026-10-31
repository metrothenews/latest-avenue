export const deals = [
  {
    id: 'single',
    name: 'Single Deal',
    features: ['One release, full label support', 'You keep ownership of your masters', '[X]% / [X]% royalty split'],
    bonuses: [],
    cta: 'Apply with a single',
  },
  {
    id: 'project',
    name: 'Project Deal',
    subtitle: 'EP / Mixtape / Album',
    badge: 'Most popular',
    features: [
      'Ongoing support across [X] releases',
      'Dedicated A&R and a full rollout plan',
      'You keep ownership of your masters',
      '[X]% / [X]% royalty split',
    ],
    bonuses: ['Custom ad creative for every drop', 'Music video support', 'Sync pitching'],
    cta: 'Apply for a project deal',
  },
]

// Options for the "deal type" field on the demo form.
export const dealOptions = [
  { value: 'single', label: 'Single deal' },
  { value: 'project', label: 'Project deal (EP / mixtape / album)' },
  { value: 'unsure', label: 'Not sure yet' },
]
